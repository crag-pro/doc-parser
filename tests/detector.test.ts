import { describe, it, expect } from "vitest";
import { isScanned } from "../src/ocr/detector.js";

describe("isScanned", () => {
  it("returns false for text-rich PDFs (>=100 chars/page)", () => {
    expect(isScanned("a".repeat(500), 5)).toBe(false);
    expect(isScanned("a".repeat(1000), 5)).toBe(false);
  });
  it("returns true for low-text PDFs (<100 chars/page)", () => {
    expect(isScanned("short", 5)).toBe(true);
    expect(isScanned("", 3)).toBe(true);
    expect(isScanned("a".repeat(50), 1)).toBe(true);
  });
  it("returns true when text is empty regardless of page count", () => {
    expect(isScanned("", 0)).toBe(true);
    expect(isScanned("", 1)).toBe(true);
  });
  it("returns false when pageCount is null", () => {
    expect(isScanned("some text", null)).toBe(false);
  });
});
