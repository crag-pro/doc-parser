import { describe, it, expect, afterEach } from "vitest";
import { writeResult, buildBatchSummary } from "../src/output/writer.js";
import { ParseResult } from "../src/config/types.js";
import { existsSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const tmpOut = join(tmpdir(), `doc-parser-test-${Date.now()}`);

afterEach(() => {
  if (existsSync(tmpOut)) rmSync(tmpOut, { recursive: true });
});

function mockResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    filePath: "/test/doc.docx", fileName: "doc.docx", extension: ".docx",
    method: "mammoth", text: "Hello world", pageCount: null,
    metadata: {}, warnings: [], parsedAt: "2026-03-28T00:00:00Z", ...overrides,
  };
}

describe("writeResult", () => {
  it("writes .json and .txt files", async () => {
    await writeResult(mockResult(), tmpOut);
    expect(existsSync(join(tmpOut, "doc.docx.json"))).toBe(true);
    expect(existsSync(join(tmpOut, "doc.docx.txt"))).toBe(true);
    const txt = readFileSync(join(tmpOut, "doc.docx.txt"), "utf8");
    expect(txt).toBe("Hello world");
    const json = JSON.parse(readFileSync(join(tmpOut, "doc.docx.json"), "utf8"));
    expect(json.method).toBe("mammoth");
  });
});

describe("buildBatchSummary", () => {
  it("aggregates results into summary", () => {
    const results: ParseResult[] = [
      mockResult({ method: "mammoth", extension: ".docx" }),
      mockResult({ method: "mammoth", extension: ".docx" }),
      mockResult({ method: "pdf-parse", extension: ".pdf" }),
      mockResult({ method: "exceljs", extension: ".xlsx", warnings: ["truncated"] }),
    ];
    const failures = [{ file: "bad.pdf", error: "corrupt" }];
    const summary = buildBatchSummary(results, failures, 1);
    expect(summary.totalFiles).toBe(6);
    expect(summary.parsed).toBe(4);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.byMethod["mammoth"]).toBe(2);
    expect(summary.byMethod["pdf-parse"]).toBe(1);
    expect(summary.byExtension[".docx"]).toBe(2);
    expect(summary.warnings).toHaveLength(1);
    expect(summary.failures).toHaveLength(1);
  });
});
