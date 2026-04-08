/**
 * Edge-case fixture generator (idempotent).
 * Run: npm run fixtures:edge
 *
 * Produces tests/fixtures/edge-cases/* synthetic fixtures for edge-case tests.
 */
import PDFDocument from "pdfkit";
import archiver from "archiver";
import ExcelJS from "exceljs";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname);
const edgeDir = resolve(fixturesDir, "edge-cases");
if (!existsSync(edgeDir)) mkdirSync(edgeDir, { recursive: true });

function out(name: string) {
  return resolve(edgeDir, name);
}

// ---- PDF ----
async function pdfBlank(): Promise<void> {
  return new Promise((res, rej) => {
    const doc = new PDFDocument({ size: "A4" });
    const s = createWriteStream(out("blank.pdf"));
    doc.pipe(s);
    // add a page but no text
    doc.end();
    s.on("finish", () => res());
    s.on("error", rej);
  });
}

async function pdfTable(): Promise<void> {
  return new Promise((res, rej) => {
    const doc = new PDFDocument({ size: "A4" });
    const s = createWriteStream(out("table.pdf"));
    doc.pipe(s);
    doc.fontSize(14).text("Compliance Report", 50, 50);
    const rows = [
      ["Item", "Status", "Owner"],
      ["SOP-001", "Approved", "Alice"],
      ["SOP-002", "Draft", "Bob"],
      ["SOP-003", "Review", "Carol"],
    ];
    let y = 100;
    for (const row of rows) {
      let x = 50;
      for (const cell of row) {
        doc.fontSize(10).text(cell, x, y, { width: 150 });
        x += 150;
      }
      y += 20;
    }
    doc.end();
    s.on("finish", () => res());
    s.on("error", rej);
  });
}

function pdfTruncated(): void {
  const src = readFileSync(resolve(fixturesDir, "minimal.pdf"));
  writeFileSync(out("truncated.pdf"), src.slice(0, 500));
}

// ---- DOCX ----
function docxTruncated(): void {
  const src = readFileSync(resolve(fixturesDir, "sample.docx"));
  writeFileSync(out("truncated.docx"), src.slice(0, 200));
}

async function docxCyrillic(): Promise<void> {
  return new Promise((res, rej) => {
    const s = createWriteStream(out("cyrillic.docx"));
    const archive = archiver("zip", { zlib: { level: 9 } });
    s.on("close", () => res());
    archive.on("error", rej);
    archive.pipe(s);

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
      { name: "[Content_Types].xml" },
    );
    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
      { name: "_rels/.rels" },
    );
    // Cyrillic: "Привет мир" — Greek: "Γειά σου κόσμε"
    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Привет мир</w:t></w:r></w:p>
    <w:p><w:r><w:t>Γειά σου κόσμε</w:t></w:r></w:p>
  </w:body>
</w:document>`,
      { name: "word/document.xml" },
    );
    archive.finalize();
  });
}

// ---- XLSX ----
async function xlsxMultiSheet(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const s1 = wb.addWorksheet("Summary");
  s1.addRow(["Name", "Score"]);
  s1.addRow(["Alice", 10]);
  s1.addRow(["Bob", 20]);
  const s2 = wb.addWorksheet("Details");
  s2.addRow(["Item", "Qty"]);
  s2.addRow(["Widget", 5]);
  await wb.xlsx.writeFile(out("multi-sheet.xlsx"));
}

async function xlsxFormulas(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet("Calc");
  s.addRow(["A", "B", "Sum"]);
  s.addRow([1, 2, { formula: "A2+B2", result: 3 }]);
  s.addRow([10, 20, { formula: "A3+B3", result: 30 }]);
  s.addRow(["Total", "", { formula: "SUM(C2:C3)", result: 33 }]);
  await wb.xlsx.writeFile(out("formulas.xlsx"));
}

async function xlsxDates(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet("Dates");
  s.addRow(["Event", "When"]);
  s.addRow(["Kickoff", new Date("2026-01-15T00:00:00Z")]);
  s.addRow(["Review", new Date("2026-02-20T00:00:00Z")]);
  await wb.xlsx.writeFile(out("dates.xlsx"));
}

async function xlsxEmpty(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Empty");
  await wb.xlsx.writeFile(out("empty.xlsx"));
}

async function xlsxMerged(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet("Merged");
  s.addRow(["Header spans two cols", ""]);
  s.mergeCells("A1:B1");
  s.addRow(["left", "right"]);
  await wb.xlsx.writeFile(out("merged.xlsx"));
}

function xlsxTruncated(): void {
  const src = readFileSync(resolve(fixturesDir, "sample.xlsx"));
  writeFileSync(out("truncated.xlsx"), src.slice(0, 200));
}

// ---- PPTX ----
async function pptxMultiSlide(): Promise<void> {
  return new Promise((res, rej) => {
    const s = createWriteStream(out("multi-slide.pptx"));
    const archive = archiver("zip", { zlib: { level: 9 } });
    s.on("close", () => res());
    archive.on("error", rej);
    archive.pipe(s);

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`,
      { name: "[Content_Types].xml" },
    );
    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
      { name: "_rels/.rels" },
    );
    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
    <p:sldId id="257" r:id="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
    <p:sldId id="258" r:id="rId3" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`,
      { name: "ppt/presentation.xml" },
    );
    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>
</Relationships>`,
      { name: "ppt/_rels/presentation.xml.rels" },
    );

    const slide = (title: string, body: string) =>
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:bodyPr/><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:txBody><a:bodyPr/><a:p><a:r><a:t>${body}</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

    archive.append(slide("Title Slide", "Intro body text"), {
      name: "ppt/slides/slide1.xml",
    });
    archive.append(slide("Second Slide", "Middle body text"), {
      name: "ppt/slides/slide2.xml",
    });
    archive.append(slide("Third Slide", "Final body text"), {
      name: "ppt/slides/slide3.xml",
    });
    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
      { name: "ppt/slides/_rels/slide1.xml.rels" },
    );
    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
      { name: "ppt/slides/_rels/slide2.xml.rels" },
    );
    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
      { name: "ppt/slides/_rels/slide3.xml.rels" },
    );

    archive.finalize();
  });
}

// ---- Plaintext ----
function plaintext(): void {
  // UTF-8 BOM
  writeFileSync(out("utf8-bom.txt"), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("hello world", "utf8")]));

  // UTF-16 LE BOM + "hi"
  const hiLE = Buffer.from([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]);
  writeFileSync(out("utf16-le.txt"), hiLE);

  // UTF-16 BE BOM + "hi"
  const hiBE = Buffer.from([0xfe, 0xff, 0x00, 0x68, 0x00, 0x69]);
  writeFileSync(out("utf16-be.txt"), hiBE);

  // Windows-1252: Hello "world" € using 0x93 (left curly), 0x94 (right curly), 0x80 (euro)
  const w1252 = Buffer.concat([
    Buffer.from("Hello ", "ascii"),
    Buffer.from([0x93]),
    Buffer.from("world", "ascii"),
    Buffer.from([0x94]),
    Buffer.from(" ", "ascii"),
    Buffer.from([0x80]),
  ]);
  writeFileSync(out("windows-1252.txt"), w1252);

  // CSV with quoted commas and embedded newlines
  writeFileSync(
    out("quoted.csv"),
    'name,notes\n"Smith, John","line1\nline2"\n"Doe, Jane","plain"\n',
  );

  // CRLF file
  writeFileSync(out("crlf.txt"), "line one\r\nline two\r\nline three\r\n");

  // CR-only file
  writeFileSync(out("cr.txt"), "line one\rline two\rline three\r");

  // Empty file
  writeFileSync(out("empty.txt"), "");

  // Whitespace-only
  writeFileSync(out("whitespace.txt"), "   \n\t\n  \n");

  // 100-byte file for maxFileSize tests
  writeFileSync(out("hundred-bytes.txt"), "a".repeat(100));
}

// ---- Cross-format ----
function crossFormat(): void {
  // No extension
  writeFileSync(out("noext"), "plain content with no extension");

  // Filename with spaces + unicode
  writeFileSync(out("café test.txt"), "unicode filename content");
}

async function main() {
  await pdfBlank();
  await pdfTable();
  pdfTruncated();
  docxTruncated();
  await docxCyrillic();
  await xlsxMultiSheet();
  await xlsxFormulas();
  await xlsxDates();
  await xlsxEmpty();
  await xlsxMerged();
  xlsxTruncated();
  await pptxMultiSlide();
  plaintext();
  crossFormat();
  console.log("Edge-case fixtures generated.");
}

await main();
