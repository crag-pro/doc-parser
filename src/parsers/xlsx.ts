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

    const formatCell = (cell: ExcelJS.Cell): string => {
      const v: unknown = cell.value;
      if (v == null) return "";
      // Formula cell: { formula, result } (or { sharedFormula, result })
      if (typeof v === "object" && ("formula" in (v as object) || "sharedFormula" in (v as object))) {
        const result = (v as { result?: unknown }).result;
        if (result == null) return "";
        if (result instanceof Date) return result.toISOString().slice(0, 10);
        if (typeof result === "object" && "error" in (result as object)) {
          return String((result as { error: unknown }).error);
        }
        return String(result);
      }
      // Date cell
      if (v instanceof Date) {
        const fmt = (cell.numFmt ?? "").toString();
        if (/h|m:|:s|s:/i.test(fmt)) return v.toISOString();
        return v.toISOString().slice(0, 10);
      }
      // Rich text
      if (typeof v === "object" && "richText" in (v as object)) {
        const rt = (v as { richText: { text: string }[] }).richText;
        return rt.map((r) => r.text).join("");
      }
      // Hyperlink
      if (typeof v === "object" && "text" in (v as object)) {
        return String((v as { text: unknown }).text);
      }
      // Error
      if (typeof v === "object" && "error" in (v as object)) {
        return String((v as { error: unknown }).error);
      }
      return String(v);
    };

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
          // Skip non-master cells of a merged range
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
