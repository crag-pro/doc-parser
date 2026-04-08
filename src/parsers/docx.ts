import mammoth from "mammoth";
import { stat } from "fs/promises";
import { basename, extname } from "path";
import { ParseResult, ParseOptions, MAX_FILE_SIZE } from "../config/types.js";

export async function parseDocx(filePath: string, options?: ParseOptions): Promise<ParseResult> {
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const warnings: string[] = [];

  try {
    const maxSize = options?.maxFileSize ?? MAX_FILE_SIZE;
    const st = await stat(filePath);
    if (st.size > maxSize) {
      throw new Error(`File size ${st.size} exceeds max ${maxSize} bytes`);
    }
    const result = await mammoth.extractRawText({ path: filePath });
    if (result.messages.length > 0) {
      for (const msg of result.messages) {
        warnings.push(`mammoth: ${msg.message}`);
      }
    }
    return {
      filePath, fileName, extension, method: "mammoth", text: result.value,
      pageCount: null, metadata: {}, warnings, parsedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      filePath, fileName, extension, method: "mammoth", text: "",
      pageCount: null, metadata: {},
      warnings: [`Failed to parse: ${(err as Error).message}`],
      parsedAt: new Date().toISOString(),
    };
  }
}
