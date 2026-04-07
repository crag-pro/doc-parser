/**
 * One-time fixture generator.
 * Run: npx tsx tools/doc-parser/tests/generate-fixtures.ts
 *
 * Generates:
 *   - tests/fixtures/minimal.pdf  — single page "Hello World" PDF
 *   - tests/fixtures/minimal.pptx — one slide, one text box PPTX
 */
import PDFDocument from "pdfkit";
import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");

async function createMinimalPdf(): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4" });
    const outputPath = `${fixturesDir}/minimal.pdf`;
    const stream = createWriteStream(outputPath);
    doc.pipe(stream);
    doc.fontSize(24).text("Hello World", 100, 100);
    doc.fontSize(12).text("This is a minimal PDF fixture for unit tests.", 100, 150);
    doc.end();
    stream.on("finish", () => { console.log("Created minimal.pdf"); resolve(); });
    stream.on("error", reject);
  });
}

async function createMinimalPptx(): Promise<void> {
  return new Promise((resolveP, reject) => {
    const outputPath = `${fixturesDir}/minimal.pptx`;
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => { console.log("Created minimal.pptx"); resolveP(); });
    archive.on("error", reject);
    archive.pipe(output);

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`,
      { name: "[Content_Types].xml" }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
      { name: "_rels/.rels" }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`,
      { name: "ppt/presentation.xml" }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`,
      { name: "ppt/_rels/presentation.xml.rels" }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r>
              <a:t>Hello Slide</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`,
      { name: "ppt/slides/slide1.xml" }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
      { name: "ppt/slides/_rels/slide1.xml.rels" }
    );

    archive.finalize();
  });
}

await createMinimalPdf();
await createMinimalPptx();
console.log("All fixtures generated.");
