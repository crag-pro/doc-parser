export type ParseMethod =
  | "unpdf"
  | "mammoth"
  | "exceljs"
  | "pptx"
  | "plaintext"
  | "tesseract"
  | "anthropic-vision";

export interface ParseResult {
  filePath: string;
  fileName: string;
  extension: string;
  method: ParseMethod;
  text: string;
  pageCount: number | null;
  metadata: Record<string, string>;
  warnings: string[];
  parsedAt: string;
}

export interface ParseOptions {
  enrich?: boolean;
  anthropicApiKey?: string;
  maxRows?: number;
  maxFileSize?: number;
}

export const MAX_FILE_SIZE = 500 * 1024 * 1024;

export interface BatchSummary {
  totalFiles: number;
  parsed: number;
  failed: number;
  skipped: number;
  byMethod: Record<string, number>;
  byExtension: Record<string, number>;
  warnings: { file: string; warning: string }[];
  failures: { file: string; error: string }[];
  parsedAt: string;
}
