import ExcelJS from "exceljs";
import { stat } from "fs/promises";
import { basename, extname } from "path";
import { ParseResult, ParseOptions, MAX_FILE_SIZE } from "../config/types.js";

const DEFAULT_MAX_ROWS = 10000;

const VALID_XLSX_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xltx", ".xltm"]);

export async function parseXlsx(filePath: string, options?: ParseOptions): Promise<ParseResult> {
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const warnings: string[] = [];
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;

  if (extension === ".xls") {
    throw new Error(
      "Legacy .xls files are not supported, convert to .xlsx first. (.xls is not supported, convert to .xlsx)"
    );
  }

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
      let dataRowCount = 0;
      sheet.eachRow((row) => {
        const isHeader = row.number === 1;
        if (!isHeader && dataRowCount >= maxRows) return;
        const values = row.values as (string | number | null | undefined)[];
        const cells = values.slice(1).map((v) => (v != null ? String(v) : ""));
        lines.push(cells.join("\t"));
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
