import ExcelJS from "exceljs";
import archiver from "archiver";
import { createWriteStream } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname);

async function createXlsx() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow(["Name", "Role", "Department"]);
  sheet.addRow(["Alice", "Engineer", "R&D"]);
  sheet.addRow(["Bob", "Manager", "QA"]);
  sheet.addRow(["Charlie", "Analyst", "Compliance"]);
  await workbook.xlsx.writeFile(resolve(fixturesDir, "sample.xlsx"));
  console.log("Created sample.xlsx");
}

async function createDocx(): Promise<void> {
  return new Promise((resolve_promise, reject) => {
    const outputPath = resolve(fixturesDir, "sample.docx");
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log("Created sample.docx");
      resolve_promise();
    });
    archive.on("error", reject);
    archive.pipe(output);

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
      { name: "[Content_Types].xml" }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
      { name: "_rels/.rels" }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
      { name: "word/_rels/document.xml.rels" }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>This is a sample Word document.</w:t></w:r></w:p>
    <w:p><w:r><w:t>It has two paragraphs.</w:t></w:r></w:p>
  </w:body>
</w:document>`,
      { name: "word/document.xml" }
    );

    archive.finalize();
  });
}

await createXlsx();
await createDocx();
console.log("All fixtures created.");
