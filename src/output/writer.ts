import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { ParseResult, BatchSummary } from "../config/types.js";

export async function writeResult(result: ParseResult, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const baseName = result.fileName;
  await writeFile(join(outDir, `${baseName}.json`), JSON.stringify(result, null, 2));
  await writeFile(join(outDir, `${baseName}.txt`), result.text);
}

export function buildBatchSummary(
  results: ParseResult[], failures: { file: string; error: string }[], skipped: number
): BatchSummary {
  const byMethod: Record<string, number> = {};
  const byExtension: Record<string, number> = {};
  const warnings: { file: string; warning: string }[] = [];

  for (const r of results) {
    byMethod[r.method] = (byMethod[r.method] || 0) + 1;
    byExtension[r.extension] = (byExtension[r.extension] || 0) + 1;
    for (const w of r.warnings) warnings.push({ file: r.fileName, warning: w });
  }

  return {
    totalFiles: results.length + failures.length + skipped,
    parsed: results.length, failed: failures.length, skipped,
    byMethod, byExtension, warnings, failures, parsedAt: new Date().toISOString(),
  };
}

export async function writeBatchSummary(summary: BatchSummary, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "_batch-summary.json"), JSON.stringify(summary, null, 2));
}
