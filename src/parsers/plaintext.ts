import { readFile, stat } from "fs/promises";
import { basename, extname } from "path";
import { ParseResult, ParseOptions, MAX_FILE_SIZE } from "../config/types.js";

const MAX_SIZE_WARN = 50 * 1024 * 1024;

export async function parsePlaintext(filePath: string, options?: ParseOptions): Promise<ParseResult> {
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const warnings: string[] = [];

  const maxSize = options?.maxFileSize ?? MAX_FILE_SIZE;
  const stats = await stat(filePath);
  if (stats.size > maxSize) {
    throw new Error(`File size ${stats.size} exceeds max ${maxSize} bytes`);
  }
  if (stats.size > MAX_SIZE_WARN) {
    warnings.push(`Large file (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
  }

  const buf = await readFile(filePath);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("latin1").decode(buf);
    warnings.push("plaintext: non-UTF8 encoding detected, decoded as latin1");
  }

  return {
    filePath, fileName, extension, method: "plaintext", text, pageCount: null,
    metadata: {}, warnings, parsedAt: new Date().toISOString(),
  };
}
