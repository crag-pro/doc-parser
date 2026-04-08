import { readFile, stat } from "fs/promises";
import { basename, extname } from "path";
import iconv from "iconv-lite";
import jschardet from "jschardet";
import { ParseResult, ParseOptions, MAX_FILE_SIZE } from "../config/types.js";

const MAX_SIZE_WARN = 50 * 1024 * 1024;

function sniffBom(buf: Buffer): "utf-8" | "utf-16le" | "utf-16be" | null {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return "utf-8";
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return "utf-16le";
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return "utf-16be";
  return null;
}

function normalizeEncoding(enc: string): string {
  const e = enc.toLowerCase().replace(/[_-]/g, "");
  if (e === "utf8") return "utf-8";
  if (e === "utf16le") return "utf-16le";
  if (e === "utf16be") return "utf-16be";
  if (e === "windows1252" || e === "cp1252") return "windows-1252";
  if (e === "ascii") return "utf-8";
  return enc.toLowerCase();
}

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

  let encoding: string | null = sniffBom(buf);

  if (!encoding) {
    try {
      const detected = jschardet.detect(buf);
      if (detected && detected.encoding && detected.confidence > 0.8) {
        encoding = normalizeEncoding(detected.encoding);
      }
    } catch {
      // ignore detection failures
    }
  }

  let text: string;
  let usedEncoding: string;

  if (encoding) {
    usedEncoding = encoding;
    text = iconv.decode(buf, encoding);
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      usedEncoding = "utf-8";
    } catch {
      usedEncoding = "windows-1252";
      text = iconv.decode(buf, "windows-1252");
    }
  }

  if (usedEncoding !== "utf-8") {
    warnings.push(`plaintext: non-UTF8 encoding detected, decoded as ${usedEncoding}`);
  }

  return {
    filePath, fileName, extension, method: "plaintext", text, pageCount: null,
    metadata: {}, warnings, parsedAt: new Date().toISOString(),
  };
}
