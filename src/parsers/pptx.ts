import { basename, extname } from "path";
import { stat } from "fs/promises";
import yauzl from "yauzl";
import { ParseResult, ParseOptions, MAX_FILE_SIZE } from "../config/types.js";

interface SlideEntry {
  name: string;
  xml: string;
}

function readPptxSlides(filePath: string): Promise<SlideEntry[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("Failed to open zip"));
        return;
      }
      const slides: SlideEntry[] = [];
      zipfile.on("error", reject);
      zipfile.on("end", () => resolve(slides));
      zipfile.on("entry", (entry) => {
        if (/^ppt\/slides\/slide\d+\.xml$/.test(entry.fileName)) {
          zipfile.openReadStream(entry, (streamErr, stream) => {
            if (streamErr || !stream) {
              reject(streamErr ?? new Error("Failed to read entry"));
              return;
            }
            const chunks: Buffer[] = [];
            stream.on("data", (c: Buffer) => chunks.push(c));
            stream.on("end", () => {
              slides.push({ name: entry.fileName, xml: Buffer.concat(chunks).toString("utf8") });
              zipfile.readEntry();
            });
            stream.on("error", reject);
          });
        } else {
          zipfile.readEntry();
        }
      });
      zipfile.readEntry();
    });
  });
}

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

    let slides: SlideEntry[];
    try {
      slides = await readPptxSlides(filePath);
    } catch (err) {
      throw new Error(`Cannot read PPTX: ${(err as Error).message}`);
    }

    slides.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    if (slides.length === 0) {
      warnings.push("pptx missing ppt/slides directory or malformed structure");
    }

    const texts: string[] = [];
    for (const slide of slides) {
      const matches = slide.xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/gs);
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

    return {
      filePath,
      fileName,
      extension,
      method: "pptx",
      text: texts.join("\n\n"),
      pageCount: slides.length,
      metadata: { slideCount: String(slides.length) },
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
