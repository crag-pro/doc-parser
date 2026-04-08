import { describe, it, expect } from "vitest";
import { parse, getSupportedExtensions } from "../src/parsers/router.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "fixtures");

describe("getSupportedExtensions", () => {
  it("returns all supported extensions", () => {
    const exts = getSupportedExtensions();
    expect(exts).toContain(".pdf");
    expect(exts).toContain(".docx");
    expect(exts).toContain(".doc");
    expect(exts).toContain(".xlsx");
    expect(exts).not.toContain(".xls");
    expect(exts).toContain(".pptx");
    expect(exts).toContain(".txt");
    expect(exts).toContain(".csv");
  });

  it("does not route .xls (legacy format unsupported)", async () => {
    const result = await parse(resolve(fixtures, "sample.txt"), undefined, ".xls");
    expect(result.text).toBe("");
    expect(result.warnings).toContain("Unsupported file extension: .xls");
  });
});

describe("parse", () => {
  it("routes .txt to plaintext parser", async () => {
    const result = await parse(resolve(fixtures, "sample.txt"));
    expect(result.method).toBe("plaintext");
    expect(result.text).toContain("sample text file");
  });

  it("routes .csv to plaintext parser", async () => {
    const result = await parse(resolve(fixtures, "sample.csv"));
    expect(result.method).toBe("plaintext");
    expect(result.text).toContain("Alice");
  });

  it("routes .docx to mammoth parser", async () => {
    const result = await parse(resolve(fixtures, "sample.docx"));
    expect(result.method).toBe("mammoth");
    expect(result.text).toContain("sample Word document");
  });

  it("routes .xlsx to exceljs parser", async () => {
    const result = await parse(resolve(fixtures, "sample.xlsx"));
    expect(result.method).toBe("exceljs");
    expect(result.text).toContain("Alice");
  });

  it("returns warning for unsupported extension", async () => {
    const result = await parse(resolve(fixtures, "sample.txt"), undefined, ".xyz");
    expect(result.text).toBe("");
    expect(result.warnings).toContain("Unsupported file extension: .xyz");
  });
});
