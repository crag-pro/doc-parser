import { describe, it, expect } from "vitest";
import { parsePlaintext } from "../src/parsers/plaintext.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "fixtures");

describe("parsePlaintext", () => {
  it("parses a .txt file", async () => {
    const result = await parsePlaintext(resolve(fixtures, "sample.txt"));
    expect(result.method).toBe("plaintext");
    expect(result.text).toContain("sample text file");
    expect(result.text).toContain("multiple lines");
    expect(result.extension).toBe(".txt");
    expect(result.fileName).toBe("sample.txt");
    expect(result.pageCount).toBeNull();
    expect(result.warnings).toHaveLength(0);
  });

  it("parses a .csv file", async () => {
    const result = await parsePlaintext(resolve(fixtures, "sample.csv"));
    expect(result.method).toBe("plaintext");
    expect(result.text).toContain("Alice");
    expect(result.text).toContain("Compliance");
    expect(result.extension).toBe(".csv");
  });

  it("decodes a latin1 file with a warning", async () => {
    const result = await parsePlaintext(resolve(fixtures, "latin1-sample.txt"));
    expect(result.text).toContain("Caf");
    expect(result.text).toContain("\u00e9");
    expect(result.warnings).toContain("plaintext: non-UTF8 encoding detected, decoded as latin1");
  });

  it("respects custom maxFileSize from options", async () => {
    await expect(
      parsePlaintext(resolve(fixtures, "sample.txt"), { maxFileSize: 1 }),
    ).rejects.toThrow(/exceeds max/);
  });
});
