import { Command } from "commander";
import { config as loadDotenv } from "dotenv";
import { resolve, extname } from "path";
import { readdir } from "fs/promises";
import { parse, getSupportedExtensions } from "./parsers/router.js";
import { writeResult, buildBatchSummary, writeBatchSummary } from "./output/writer.js";
import { ParseResult, ParseOptions } from "./config/types.js";
import cliProgress from "cli-progress";

loadDotenv();

const program = new Command();

program
  .name("doc-parser")
  .description("Extract text content from documents (PDF, Word, Excel, PowerPoint)")
  .version("0.1.0");

program
  .command("parse <file>")
  .description("Parse a single file")
  .option("--out <dir>", "Output directory (default: stdout)")
  .option("--enrich", "Use AI vision for scanned PDFs")
  .option("--anthropic-key <key>", "Anthropic API key")
  .option("--max-rows <n>", "Max Excel rows", "10000")
  .action(async (file, opts) => {
    const options: ParseOptions = {
      enrich: opts.enrich,
      anthropicApiKey: opts.anthropicKey ?? process.env.ANTHROPIC_API_KEY,
      maxRows: parseInt(opts.maxRows, 10),
    };

    const filePath = resolve(file);
    const result = await parse(filePath, options);

    if (opts.out) {
      await writeResult(result, resolve(opts.out));
      console.log(`Parsed: ${result.fileName} (${result.method})`);
      if (result.warnings.length > 0) {
        for (const w of result.warnings) console.log(`  Warning: ${w}`);
      }
    } else {
      console.log(result.text);
    }
  });

program
  .command("batch <dir>")
  .description("Parse all documents in a directory")
  .requiredOption("--out <dir>", "Output directory")
  .option("--enrich", "Use AI vision for scanned PDFs")
  .option("--yes", "Skip cost confirmation for AI vision")
  .option("--anthropic-key <key>", "Anthropic API key")
  .option("--ext <extensions>", "Filter by extension (comma-separated)")
  .option("--concurrency <n>", "Parallel parsing", "5")
  .option("--max-rows <n>", "Max Excel rows", "10000")
  .action(async (dir, opts) => {
    const inputDir = resolve(dir);
    const outDir = resolve(opts.out);
    const supported = new Set(getSupportedExtensions());
    const filterExts = opts.ext
      ? new Set(opts.ext.split(",").map((e: string) => e.trim().toLowerCase()))
      : null;

    const options: ParseOptions = {
      enrich: opts.enrich,
      anthropicApiKey: opts.anthropicKey ?? process.env.ANTHROPIC_API_KEY,
      maxRows: parseInt(opts.maxRows, 10),
    };

    const files: string[] = [];
    async function collectFiles(dirPath: string) {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = resolve(dirPath, entry.name);
        if (entry.isDirectory()) {
          await collectFiles(fullPath);
        } else {
          const ext = extname(entry.name).toLowerCase();
          if (!supported.has(ext)) continue;
          if (filterExts && !filterExts.has(ext)) continue;
          files.push(fullPath);
        }
      }
    }
    await collectFiles(inputDir);

    if (files.length === 0) {
      console.log("No supported files found.");
      return;
    }

    console.log(`Found ${files.length} files to parse.`);

    const concurrency = parseInt(opts.concurrency, 10);
    const results: ParseResult[] = [];
    const failures: { file: string; error: string }[] = [];
    let skipped = 0;

    const bar = new cliProgress.SingleBar(
      { format: "  [{bar}] {percentage}% | {value}/{total} | {file}" },
      cliProgress.Presets.shades_classic
    );
    bar.start(files.length, 0, { file: "" });

    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(async (filePath) => {
          const result = await parse(filePath, options);
          await writeResult(result, outDir);
          return result;
        })
      );

      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === "fulfilled") {
          results.push(r.value);
        } else {
          failures.push({
            file: batch[j].split("/").pop() ?? batch[j],
            error: r.reason?.message ?? "Unknown error",
          });
        }
        bar.update(i + j + 1, { file: batch[j].split("/").pop() ?? "" });
      }
    }

    bar.stop();

    const summary = buildBatchSummary(results, failures, skipped);
    await writeBatchSummary(summary, outDir);

    console.log(`\nDone. Output: ${outDir}`);
    console.log(`  Parsed: ${summary.parsed}, Failed: ${summary.failed}, Skipped: ${summary.skipped}`);
    if (summary.warnings.length > 0) {
      console.log(`  Warnings: ${summary.warnings.length}`);
    }
  });

program.parse();
