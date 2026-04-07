import { describe, it, expect } from "vitest";
import { parsePptx } from "../src/parsers/pptx.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "fixtures");

describe("parsePptx", () => {
  it("returns empty with warning for non-PPTX file", async () => {
    const result = await parsePptx(resolve(fixtures, "sample.txt"));
    expect(result.text).toBe("");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("parsePptx — minimal.pptx fixture", () => {
  it("extracts text from slide XML", async () => {
    const result = await parsePptx(resolve(fixtures, "minimal.pptx"));
    expect(result.method).toBe("pptx");
    expect(result.text).toContain("Hello Slide");
    expect(result.extension).toBe(".pptx");
    expect(result.warnings).toHaveLength(0);
  });

  it("returns slideCount in metadata", async () => {
    const result = await parsePptx(resolve(fixtures, "minimal.pptx"));
    expect(result.pageCount).toBe(1);
  });
});
