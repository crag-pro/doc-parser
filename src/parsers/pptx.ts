import { basename, extname, join } from "path";
import { ParseResult, ParseOptions, MAX_FILE_SIZE } from "../config/types.js";
import { execFile } from "child_process";
import { promisify } from "util";
import { readdir, readFile, rm, stat } from "fs/promises";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

export async function parsePptx(filePath: string, options?: ParseOptions): Promise<ParseResult> {
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const warnings: string[] = [];

  try {
    const maxSize = options?.maxFileSize ?? MAX_FILE_SIZE;
    const st = await stat(filePath);
    if (st.size > maxSize) {
      throw new Error(`File size ${st.size} exceeds max ${maxSize} bytes`);
    }
    const tmpDir = join(tmpdir(), `doc-parser-pptx-${Date.now()}`);

    try {
      await execFileAsync("unzip", ["-o", "-q", filePath, "-d", tmpDir]);
    } catch (err) {
      throw new Error(`Cannot unzip PPTX: ${(err as Error).message}`);
    }

    // Find slide XML files
    const slideDir = join(tmpDir, "ppt", "slides");
    let slideFiles: string[] = [];
    try {
      const entries = await readdir(slideDir);
      slideFiles = entries
        .filter((f) => f.match(/^slide\d+\.xml$/))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    } catch {
      warnings.push("pptx missing ppt/slides directory or malformed structure");
    }

    const texts: string[] = [];
    for (const slideFile of slideFiles) {
      const xml = await readFile(join(slideDir, slideFile), "utf8");
      const matches = xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/gs);
      const slideTexts: string[] = [];
      for (const match of matches) {
        const decoded = match[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        slideTexts.push(decoded);
      }
      if (slideTexts.length > 0) {
        texts.push(slideTexts.join(" "));
      }
    }

    // Cleanup
    try {
      await rm(tmpDir, { recursive: true });
    } catch {}

    return {
      filePath,
      fileName,
      extension,
      method: "pptx",
      text: texts.join("\n\n"),
      pageCount: slideFiles.length,
      metadata: { slideCount: String(slideFiles.length) },
      warnings,
      parsedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      filePath,
      fileName,
      extension,
      method: "pptx",
      text: "",
      pageCount: null,
      metadata: {},
      warnings: [`Failed to parse: ${(err as Error).message}`],
      parsedAt: new Date().toISOString(),
    };
  }
}
