import { readFile, stat } from "fs/promises";
import { basename, extname } from "path";
import { extractText, getDocumentProxy } from "unpdf";
import { ParseResult, ParseOptions, MAX_FILE_SIZE } from "../config/types.js";
import { isScanned } from "../ocr/detector.js";
import { hasTesseract, runTesseract } from "../ocr/tesseract.js";
import { parseWithAnthropic } from "../ocr/anthropic-vision.js";

export async function parsePdf(filePath: string, options?: ParseOptions): Promise<ParseResult> {
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const warnings: string[] = [];

  try {
    const maxSize = options?.maxFileSize ?? MAX_FILE_SIZE;
    const st = await stat(filePath);
    if (st.size > maxSize) {
      throw new Error(`File size ${st.size} exceeds max ${maxSize} bytes`);
    }
    const buffer = await readFile(filePath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text;
    const pageCount = extracted.totalPages;

    if (!isScanned(text, pageCount)) {
      return {
        filePath, fileName, extension, method: "unpdf", text, pageCount,
        metadata: {},
        warnings, parsedAt: new Date().toISOString(),
      };
    }

    warnings.push("Low text density — likely scanned document");

    if (await hasTesseract()) {
      try {
        const ocrText = await runTesseract(filePath);
        if (ocrText.length > text.length) {
          return {
            filePath, fileName, extension, method: "tesseract", text: ocrText,
            pageCount, metadata: {}, warnings, parsedAt: new Date().toISOString(),
          };
        }
      } catch (err) {
        warnings.push(`Tesseract failed: ${(err as Error).message}`);
      }
    } else {
      warnings.push("Tesseract not installed — install for local OCR");
    }

    if (options?.enrich && options?.anthropicApiKey) {
      try {
        const visionText = await parseWithAnthropic(filePath, options.anthropicApiKey);
        return {
          filePath, fileName, extension, method: "anthropic-vision", text: visionText,
          pageCount, metadata: {}, warnings, parsedAt: new Date().toISOString(),
        };
      } catch (err) {
        warnings.push(`AI vision failed: ${(err as Error).message}`);
      }
    } else if (!options?.enrich) {
      warnings.push("Scanned PDF — use --enrich for OCR");
    }

    return {
      filePath, fileName, extension, method: "unpdf", text, pageCount,
      metadata: {}, warnings, parsedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      filePath, fileName, extension, method: "unpdf", text: "", pageCount: null,
      metadata: {}, warnings: [`Failed to parse: ${(err as Error).message}`],
      parsedAt: new Date().toISOString(),
    };
  }
}
