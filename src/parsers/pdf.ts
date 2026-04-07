import { readFile } from "fs/promises";
import { basename, extname } from "path";
import pdfParse from "pdf-parse";
import { ParseResult, ParseOptions } from "../config/types.js";
import { isScanned } from "../ocr/detector.js";
import { hasTesseract, runTesseract } from "../ocr/tesseract.js";
import { parseWithAnthropic } from "../ocr/anthropic-vision.js";

export async function parsePdf(filePath: string, options?: ParseOptions): Promise<ParseResult> {
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const warnings: string[] = [];

  try {
    const buffer = await readFile(filePath);
    const data = await pdfParse(buffer);
    const text = data.text;
    const pageCount = data.numpages;

    if (!isScanned(text, pageCount)) {
      return {
        filePath, fileName, extension, method: "pdf-parse", text, pageCount,
        metadata: { title: data.info?.Title ?? "", author: data.info?.Author ?? "" },
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
      filePath, fileName, extension, method: "pdf-parse", text, pageCount,
      metadata: {}, warnings, parsedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      filePath, fileName, extension, method: "pdf-parse", text: "", pageCount: null,
      metadata: {}, warnings: [`Failed to parse: ${(err as Error).message}`],
      parsedAt: new Date().toISOString(),
    };
  }
}
