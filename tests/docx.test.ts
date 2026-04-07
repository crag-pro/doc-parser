import { describe, it, expect } from "vitest";
import { parseDocx } from "../src/parsers/docx.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "fixtures");

describe("parseDocx", () => {
  it("extracts text from a .docx file", async () => {
    const result = await parseDocx(resolve(fixtures, "sample.docx"));
    expect(result.method).toBe("mammoth");
    expect(result.text).toContain("sample Word document");
    expect(result.text).toContain("two paragraphs");
    expect(result.extension).toBe(".docx");
    expect(result.fileName).toBe("sample.docx");
    expect(result.warnings).toHaveLength(0);
  });

  it("returns empty text with warning for corrupt file", async () => {
    const result = await parseDocx(resolve(fixtures, "sample.txt"));
    expect(result.text).toBe("");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
