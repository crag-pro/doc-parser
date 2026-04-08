import { extname } from "path";
import { ParseResult, ParseOptions } from "../config/types.js";
import { parsePlaintext } from "./plaintext.js";
import { parseDocx } from "./docx.js";
import { parseXlsx } from "./xlsx.js";
import { parsePdf } from "./pdf.js";
import { parsePptx } from "./pptx.js";

const EXTENSION_MAP: Record<string, (filePath: string, options?: ParseOptions) => Promise<ParseResult>> = {
  ".txt": parsePlaintext,
  ".csv": parsePlaintext,
  ".msg": parsePlaintext,
  ".pdf": parsePdf,
  ".docx": parseDocx,
  ".doc": parseDocx,
  ".xlsx": parseXlsx,
  ".pptx": parsePptx,
};

export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MAP);
}

export async function parse(
  filePath: string, options?: ParseOptions, overrideExtension?: string
): Promise<ParseResult> {
  const ext = (overrideExtension ?? extname(filePath)).toLowerCase();
  const parser = EXTENSION_MAP[ext];

  if (!parser) {
    return {
      filePath, fileName: filePath.split("/").pop() ?? filePath, extension: ext,
      method: "plaintext", text: "", pageCount: null, metadata: {},
      warnings: [`Unsupported file extension: ${ext}`], parsedAt: new Date().toISOString(),
    };
  }

  return parser(filePath, options);
}
