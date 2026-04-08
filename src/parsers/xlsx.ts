import ExcelJS from "exceljs";
import { createRequire } from "module";
import { stat } from "fs/promises";
import { basename, extname } from "path";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");
import { ParseResult, ParseOptions, MAX_FILE_SIZE } from "../config/types.js";

const DEFAULT_MAX_ROWS = 10000;

const VALID_XLSX_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xlsb", ".xls"]);

export async function parseXlsx(filePath: string, options?: ParseOptions): Promise<ParseResult> {
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const warnings: string[] = [];
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
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const lines: string[] = [];
    let totalRows = 0;

    workbook.eachSheet((sheet) => {
      lines.push(`--- Sheet: ${sheet.name} ---`);
      let rowCount = 0;
      let dataRowCount = 0;
      sheet.eachRow((row) => {
        // Always include the header row (row number 1); apply maxRows to data rows only
        const isHeader = row.number === 1;
        if (!isHeader && dataRowCount >= maxRows) return;
        const values = row.values as (string | number | null | undefined)[];
        const cells = values.slice(1).map((v) => (v != null ? String(v) : ""));
        lines.push(cells.join("\t"));
        rowCount++;
        totalRows++;
        if (!isHeader) dataRowCount++;
      });
      if (dataRowCount >= maxRows) {
        warnings.push(`Sheet "${sheet.name}" truncated at ${maxRows} rows`);
      }
    });

    return {
      filePath,
      fileName,
      extension,
      method: "exceljs",
      text: lines.join("\n"),
      pageCount: null,
      metadata: {
        sheetCount: String(workbook.worksheets.length),
        totalRows: String(totalRows),
      },
      warnings,
      parsedAt: new Date().toISOString(),
    };
  } catch (err) {
    // ExcelJS fails on some xlsx structures — fall back to SheetJS
    const warnings: string[] = [`ExcelJS failed (${(err as Error).message}), falling back to SheetJS`];
    try {
      const workbook = XLSX.readFile(filePath);
      const lines: string[] = [];
      let totalRows = 0;
      for (const sheetName of workbook.SheetNames) {
        lines.push(`--- Sheet: ${sheetName} ---`);
        const sheet = workbook.Sheets[sheetName];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        for (const row of rows.slice(0, maxRows + 1)) {
          lines.push((row as string[]).map(String).join("\t"));
          totalRows++;
        }
        if (rows.length > maxRows + 1) warnings.push(`Sheet "${sheetName}" truncated at ${maxRows} rows`);
      }
      return {
        filePath, fileName, extension,
        method: "exceljs",
        text: lines.join("\n"),
        pageCount: null,
        metadata: { sheetCount: String(workbook.SheetNames.length), totalRows: String(totalRows) },
        warnings,
        parsedAt: new Date().toISOString(),
      };
    } catch (fallbackErr) {
      return {
        filePath, fileName, extension,
        method: "exceljs",
        text: "",
        pageCount: null,
        metadata: {},
        warnings: [...warnings, `SheetJS also failed: ${(fallbackErr as Error).message}`],
        parsedAt: new Date().toISOString(),
      };
    }
  }
}
