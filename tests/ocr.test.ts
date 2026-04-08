import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── anthropic-vision.ts ─────────────────────────────────────────────────────

vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  return {
    ...actual,
    readFile: vi.fn(async () => Buffer.from("fake-pdf-bytes")),
  };
});

vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn();
  const MockAnthropic = vi.fn(() => ({
    messages: { create: mockCreate },
  }));
  // Expose mockCreate so tests can access it
  (MockAnthropic as any).__mockCreate = mockCreate;
  return { default: MockAnthropic };
});

describe("parseWithAnthropic", () => {
  let parseWithAnthropic: typeof import("../src/ocr/anthropic-vision.js").parseWithAnthropic;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    // Re-import after reset so fresh module picks up mocks
    const mod = await import("../src/ocr/anthropic-vision.js");
    parseWithAnthropic = mod.parseWithAnthropic;

    const Anthropic = (await import("@anthropic-ai/sdk")).default as any;
    mockCreate = Anthropic.__mockCreate;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns text from a successful Anthropic response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Extracted document text" }],
    });

    const result = await parseWithAnthropic("/fake/file.pdf", "sk-ant-test");
    expect(result).toBe("Extracted document text");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("throws when response has no text block", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "tu_1", name: "foo", input: {} }],
    });

    await expect(parseWithAnthropic("/fake/file.pdf", "sk-ant-test", 0)).rejects.toThrow(
      "AI vision returned no text content",
    );
  });

  it("concatenates multiple text blocks", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: "text", text: "Part one" },
        { type: "text", text: "Part two" },
      ],
    });

    const result = await parseWithAnthropic("/fake/file.pdf", "sk-ant-test");
    expect(result).toContain("Part one");
    expect(result).toContain("Part two");
  });

  it("retries on failure and succeeds on second attempt", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("rate_limit"))
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Retry succeeded" }],
      });

    const result = await parseWithAnthropic("/fake/file.pdf", "sk-ant-test", 2);
    expect(result).toBe("Retry succeeded");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries", async () => {
    const err = new Error("persistent error");
    mockCreate.mockRejectedValue(err);

    await expect(parseWithAnthropic("/fake/file.pdf", "sk-ant-test", 1)).rejects.toThrow(
      "persistent error",
    );
    // 1 retry = 2 total attempts
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

// ─── tesseract.ts ─────────────────────────────────────────────────────────────

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

describe("hasTesseract", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns true when 'which tesseract' resolves", async () => {
    const { execFile } = await import("child_process");
    vi.mocked(execFile).mockImplementation((...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") cb(null, "/usr/bin/tesseract", "");
      return {} as any;
    });

    const { hasTesseract } = await import("../src/ocr/tesseract.js");
    const result = await hasTesseract();
    expect(result).toBe(true);
  });

  it("returns false when 'which tesseract' rejects", async () => {
    const { execFile } = await import("child_process");
    vi.mocked(execFile).mockImplementation((...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") cb(new Error("not found"), "", "");
      return {} as any;
    });

    vi.resetModules();
    const { hasTesseract } = await import("../src/ocr/tesseract.js");
    const result = await hasTesseract();
    expect(result).toBe(false);
  });
});

describe("runTesseract", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns trimmed text from OCR output file", async () => {
    const { execFile } = await import("child_process");

    // First call: tesseract command succeeds
    vi.mocked(execFile).mockImplementation((...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") cb(null, "", "");
      return {} as any;
    });

    // Mock fs/promises readFile + unlink for the output file
    const fsMod = await import("fs/promises");
    vi.mocked(fsMod.readFile).mockResolvedValueOnce(
      "  OCR extracted text  " as any,
    );

    const { runTesseract } = await import("../src/ocr/tesseract.js");
    const result = await runTesseract("/tmp/test.pdf");
    expect(result).toBe("OCR extracted text");
  });

  it("throws a descriptive error when tesseract fails", async () => {
    const { execFile } = await import("child_process");
    vi.mocked(execFile).mockImplementation((...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") cb(new Error("tesseract crashed"), "", "");
      return {} as any;
    });

    vi.resetModules();
    const { runTesseract } = await import("../src/ocr/tesseract.js");
    await expect(runTesseract("/tmp/test.pdf")).rejects.toThrow(
      "Tesseract OCR failed",
    );
  });
});
