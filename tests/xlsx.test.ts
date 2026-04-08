import { describe, it, expect } from "vitest";
import { parseXlsx } from "../src/parsers/xlsx.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "fixtures");

describe("parseXlsx", () => {
  it("extracts text from all sheets", async () => {
    const result = await parseXlsx(resolve(fixtures, "sample.xlsx"));
    expect(result.method).toBe("exceljs");
    expect(result.text).toContain("Alice");
    expect(result.text).toContain("Engineer");
    expect(result.text).toContain("Compliance");
    expect(result.extension).toBe(".xlsx");
    expect(result.metadata).toHaveProperty("sheetCount");
  });

  it("respects maxRows option", async () => {
    const result = await parseXlsx(resolve(fixtures, "sample.xlsx"), { maxRows: 2 });
    expect(result.text).toContain("Alice");
    expect(result.text).toContain("Bob");
  });

  it("returns empty text with warning for corrupt file", async () => {
    const result = await parseXlsx(resolve(fixtures, "sample.txt"));
    expect(result.text).toBe("");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

