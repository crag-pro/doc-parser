import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);
let tesseractAvailable: boolean | null = null;

export async function hasTesseract(): Promise<boolean> {
  if (tesseractAvailable !== null) return tesseractAvailable;
  try {
    await execFileAsync("which", ["tesseract"]);
    tesseractAvailable = true;
  } catch {
    tesseractAvailable = false;
  }
  return tesseractAvailable;
}

export async function runTesseract(pdfPath: string): Promise<string> {
  const outputBase = join(tmpdir(), `doc-parser-ocr-${Date.now()}`);
  try {
    await execFileAsync("tesseract", [pdfPath, outputBase, "--oem", "1"], { timeout: 120000 });
    const { readFile } = await import("fs/promises");
    const text = await readFile(`${outputBase}.txt`, "utf8");
    try { const { unlink } = await import("fs/promises"); await unlink(`${outputBase}.txt`); } catch {}
    return text.trim();
  } catch (err) {
    throw new Error(`Tesseract OCR failed: ${(err as Error).message}`);
  }
}
