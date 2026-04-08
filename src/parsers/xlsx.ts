import ExcelJS from "exceljs";
import { stat } from "fs/promises";
import { basename, extname } from "path";
import yauzl from "yauzl";
import { ParseResult, ParseOptions, MAX_FILE_SIZE } from "../config/types.js";

const DEFAULT_MAX_ROWS = 10000;

const VALID_XLSX_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xltx", ".xltm"]);

// Matches dataValidation sqref="...1048576" — the hang-causing full-column range.
// ExcelJS eager reader expands these into per-cell maps (~1M entries per range)
// and blocks the event loop. Streaming reader skips dataValidations entirely.
const FULL_COLUMN_PATTERN = /<dataValidation[^>]*sqref="[^"]*1048576/;

const formatCell = (cell: ExcelJS.Cell): string => {
  const v: unknown = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && ("formula" in (v as object) || "sharedFormula" in (v as object))) {
    const result = (v as { result?: unknown }).result;
    if (result == null) return "";
    if (result instanceof Date) return result.toISOString().slice(0, 10);
    if (typeof result === "object" && "error" in (result as object)) {
      return String((result as { error: unknown }).error);
    }
    return String(result);
  }
  if (v instanceof Date) {
    const fmt = (cell.numFmt ?? "").toString();
    if (/h|m:|:s|s:/i.test(fmt)) return v.toISOString();
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "object" && "richText" in (v as object)) {
    const rt = (v as { richText: { text: string }[] }).richText;
    return rt.map((r) => r.text).join("");
  }
  if (typeof v === "object" && "text" in (v as object)) {
    return String((v as { text: unknown }).text);
  }
  if (typeof v === "object" && "error" in (v as object)) {
    return String((v as { error: unknown }).error);
  }
  return String(v);
};

// Scan the xlsx zip (read-only, lazy) for full-column dataValidation ranges.
// Returns true if the file is known to trip the ExcelJS eager-mode hang.
async function hasFullColumnValidations(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return resolve(false);
      let found = false;
      zip.on("entry", (entry: yauzl.Entry) => {
        if (found || !/^xl\/worksheets\/sheet\d+\.xml$/.test(entry.fileName)) {
          return zip.readEntry();
        }
        zip.openReadStream(entry, (e, stream) => {
          if (e || !stream) return zip.readEntry();
          const chunks: Buffer[] = [];
          stream.on("data", (c: Buffer) => chunks.push(c));
          stream.on("end", () => {
            const xml = Buffer.concat(chunks).toString("utf8");
            if (FULL_COLUMN_PATTERN.test(xml)) found = true;
            zip.readEntry();
          });
          stream.on("error", () => zip.readEntry());
        });
      });
      zip.on("end", () => resolve(found));
      zip.on("error", () => resolve(false));
      zip.readEntry();
    });
  });
}

async function parseEager(
  filePath: string,
  maxRows: number,
): Promise<{ text: string; warnings: string[]; sheetCount: number; totalRows: number }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const lines: string[] = [];
  const warnings: string[] = [];
  let totalRows = 0;

  workbook.eachSheet((sheet) => {
    lines.push(`--- Sheet: ${sheet.name} ---`);
    let dataRowCount = 0;
    sheet.eachRow((row) => {
      const isHeader = row.number === 1;
      if (!isHeader && dataRowCount >= maxRows) return;
      const cells: string[] = [];
      const cellCount = row.cellCount;
      for (let col = 1; col <= cellCount; col++) {
        const cell = sheet.getCell(row.number, col);
        if (cell.isMerged && cell.master !== cell) {
          cells.push("");
          continue;
        }
        cells.push(formatCell(cell));
      }
      lines.push(cells.join("\t"));
      totalRows++;
      if (!isHeader) dataRowCount++;
    });
    if (dataRowCount >= maxRows) {
      warnings.push(`Sheet "${sheet.name}" truncated at ${maxRows} rows`);
    }
  });

  return { text: lines.join("\n"), warnings, sheetCount: workbook.worksheets.length, totalRows };
}

async function parseStreaming(
  filePath: string,
  maxRows: number,
): Promise<{ text: string; warnings: string[]; sheetCount: number; totalRows: number }> {
  type SheetBuf = { name: string; rowLines: string[]; dataRowCount: number; truncated: boolean };
  const sheets: SheetBuf[] = [];
  const warnings: string[] = [];
  let totalRows = 0;

  const reader = new (
    ExcelJS as unknown as {
      stream: { xlsx: { WorkbookReader: new (path: string, opts: object) => EventEmitterLike } };
    }
  ).stream.xlsx.WorkbookReader(filePath, {
    entries: "ignore",
    sharedStrings: "cache",
    styles: "cache",
    hyperlinks: "ignore",
    worksheets: "emit",
  });

  await new Promise<void>((resolve, reject) => {
    reader.on("worksheet", (worksheet: StreamWorksheet) => {
      const buf: SheetBuf = {
        name: worksheet.name || `Sheet${worksheet.id}`,
        rowLines: [],
        dataRowCount: 0,
        truncated: false,
      };
      sheets.push(buf);

      worksheet.on("row", (row: StreamRow) => {
        const isHeader = row.number === 1;
        if (!isHeader && buf.dataRowCount >= maxRows) {
          buf.truncated = true;
          return;
        }
        const cells: string[] = [];
        row.eachCell?.((cell, colNumber) => {
          while (cells.length < colNumber - 1) cells.push("");
          cells[colNumber - 1] = formatCell(cell as ExcelJS.Cell);
        });
        buf.rowLines.push(cells.join("\t"));
        totalRows++;
        if (!isHeader) buf.dataRowCount++;
      });
    });
    reader.on("end", () => resolve());
    reader.on("error", (err: Error) => reject(err));
    const readPromise = (reader as unknown as { read: () => Promise<void> | void }).read();
    if (readPromise && typeof (readPromise as Promise<void>).catch === "function") {
      (readPromise as Promise<void>).catch(reject);
    }
  });

  const lines: string[] = [];
  for (const s of sheets) {
    lines.push(`--- Sheet: ${s.name} ---`);
    for (const l of s.rowLines) lines.push(l);
    if (s.truncated) warnings.push(`Sheet "${s.name}" truncated at ${maxRows} rows`);
  }

  return { text: lines.join("\n"), warnings, sheetCount: sheets.length, totalRows };
}

export async function parseXlsx(filePath: string, options?: ParseOptions): Promise<ParseResult> {
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;

  if (!VALID_XLSX_EXTENSIONS.has(extension)) {
    return {
      filePath, fileName, extension,
      method: "exceljs",
      text: "",
      pageCount: null,
      metadata: {},
      warnings: [`Not a valid spreadsheet file: ${fileName}`],
      parsedAt: new Date().toISOString(),
    };
  }

  try {
    const maxSize = options?.maxFileSize ?? MAX_FILE_SIZE;
    const st = await stat(filePath);
    if (st.size > maxSize) {
      throw new Error(`File size ${st.size} exceeds max ${maxSize} bytes`);
    }

    // Pre-scan for full-column dataValidation ranges. If present, use the
    // streaming reader to sidestep the eager-mode hang. Otherwise use eager
    // mode, which correctly handles merged cells via cell.master (the
    // streaming reader doesn't expose merge metadata).
    const mustStream = await hasFullColumnValidations(filePath);
    const result = mustStream
      ? await parseStreaming(filePath, maxRows)
      : await parseEager(filePath, maxRows);

    return {
      filePath,
      fileName,
      extension,
      method: "exceljs",
      text: result.text,
      pageCount: null,
      metadata: {
        sheetCount: String(result.sheetCount),
        totalRows: String(result.totalRows),
      },
      warnings: result.warnings,
      parsedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      filePath, fileName, extension,
      method: "exceljs",
      text: "",
      pageCount: null,
      metadata: {},
      warnings: [`ExcelJS failed: ${(err as Error).message}`],
      parsedAt: new Date().toISOString(),
    };
  }
}

interface EventEmitterLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): void;
}
interface StreamRow {
  number: number;
  cellCount?: number;
  eachCell?: (iter: (cell: unknown, colNumber: number) => void) => void;
}
interface StreamWorksheet extends EventEmitterLike {
  name: string;
  id: number;
}
