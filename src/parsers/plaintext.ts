import { readFile, stat } from "fs/promises";
import { basename, extname } from "path";
import { ParseResult } from "../config/types.js";

const MAX_SIZE_WARN = 50 * 1024 * 1024;

export async function parsePlaintext(filePath: string): Promise<ParseResult> {
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const warnings: string[] = [];

  const stats = await stat(filePath);
  if (stats.size > MAX_SIZE_WARN) {
    warnings.push(`Large file (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
  }

  const text = await readFile(filePath, "utf8");

  return {
    filePath, fileName, extension, method: "plaintext", text, pageCount: null,
    metadata: {}, warnings, parsedAt: new Date().toISOString(),
  };
}
