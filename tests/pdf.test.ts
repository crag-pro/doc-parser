import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { parsePdf } from "../src/parsers/pdf.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "fixtures");

// Mock all OCR/vision modules up front so spies work on ESM exports
vi.mock("../src/ocr/detector.js", () => ({
  isScanned: vi.fn(() => false),
}));

vi.mock("../src/ocr/tesseract.js", () => ({
  hasTesseract: vi.fn(async () => false),
  runTesseract: vi.fn(async () => ""),
}));

vi.mock("../src/ocr/anthropic-vision.js", () => ({
  parseWithAnthropic: vi.fn(async () => ""),
}));

// Mock pdf-parse so we control what it returns without needing a real valid PDF
vi.mock("pdf-parse", () => ({
  default: vi.fn(async () => ({
    text: "Hello World",
    numpages: 1,
    info: { Title: "Test", Author: "Tester" },
  })),
}));

import { isScanned } from "../src/ocr/detector.js";
import { hasTesseract, runTesseract } from "../src/ocr/tesseract.js";
import { parseWithAnthropic } from "../src/ocr/anthropic-vision.js";

describe("parsePdf", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty with warning for non-PDF file", async () => {
    // pdf-parse throws for non-PDF files — simulate that
    const { default: pdfParse } = await import("pdf-parse");
    vi.mocked(pdfParse).mockRejectedValueOnce(new Error("Invalid PDF"));
    vi.mocked(isScanned).mockReturnValue(false);

    const result = await parsePdf(resolve(fixtures, "sample.txt"));
    expect(result.text).toBe("");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("parsePdf — normal text extraction", () => {
  beforeEach(() => {
    vi.mocked(isScanned).mockReturnValue(false);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("extracts text from a valid PDF file", async () => {
    const result = await parsePdf(resolve(__dirname, "fixtures/minimal.pdf"));
    expect(result.method).toBe("pdf-parse");
    expect(result.text).toContain("Hello World");
    expect(result.extension).toBe(".pdf");
    expect(result.warnings).toHaveLength(0);
  });

  it("returns pageCount from PDF", async () => {
    const result = await parsePdf(resolve(__dirname, "fixtures/minimal.pdf"));
    expect(result.pageCount).toBeGreaterThan(0);
  });
});

describe("parsePdf — OCR Tesseract fallback", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("uses Tesseract when isScanned returns true and Tesseract is available", async () => {
    vi.mocked(isScanned).mockReturnValue(true);
    vi.mocked(hasTesseract).mockResolvedValue(true);
    vi.mocked(runTesseract).mockResolvedValue("OCR extracted text from scanned page");

    const result = await parsePdf(resolve(__dirname, "fixtures/minimal.pdf"));
    expect(result.method).toBe("tesseract");
    expect(result.text).toBe("OCR extracted text from scanned page");
  });

  it("falls through to pdf-parse when Tesseract returns less text", async () => {
    vi.mocked(isScanned).mockReturnValue(true);
    vi.mocked(hasTesseract).mockResolvedValue(true);
    vi.mocked(runTesseract).mockResolvedValue("x"); // shorter than "Hello World" from pdf-parse mock

    const result = await parsePdf(resolve(__dirname, "fixtures/minimal.pdf"));
    expect(result.method).toBe("pdf-parse");
  });

  it("warns when Tesseract is not installed", async () => {
    vi.mocked(isScanned).mockReturnValue(true);
    vi.mocked(hasTesseract).mockResolvedValue(false);

    const result = await parsePdf(resolve(__dirname, "fixtures/minimal.pdf"));
    expect(
      result.warnings.some(
        (w) => w.includes("Tesseract") || w.includes("tesseract") || w.includes("--enrich"),
      ),
    ).toBe(true);
  });
});

describe("parsePdf — Anthropic Vision path", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("uses Anthropic Vision when Tesseract produces less text and enrich=true", async () => {
    vi.mocked(isScanned).mockReturnValue(true);
    vi.mocked(hasTesseract).mockResolvedValue(true);
    vi.mocked(runTesseract).mockResolvedValue("x");
    vi.mocked(parseWithAnthropic).mockResolvedValue("Anthropic Vision extracted text");

    const result = await parsePdf(resolve(__dirname, "fixtures/minimal.pdf"), {
      enrich: true,
      anthropicApiKey: "sk-ant-test-key",
    });
    expect(result.method).toBe("anthropic-vision");
    expect(result.text).toBe("Anthropic Vision extracted text");
  });

  it("adds warning when enrich=false on a scanned PDF", async () => {
    vi.mocked(isScanned).mockReturnValue(true);
    vi.mocked(hasTesseract).mockResolvedValue(false);

    const result = await parsePdf(resolve(__dirname, "fixtures/minimal.pdf"));
    expect(
      result.warnings.some((w) => w.includes("--enrich") || w.includes("enrich")),
    ).toBe(true);
  });
});
