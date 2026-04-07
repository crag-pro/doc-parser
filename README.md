# @crag-pro/doc-parser

Multi-format document parser with OCR fallback. Extracts text from PDF, Word, Excel, PowerPoint, and plaintext files. Falls back to Tesseract OCR for scanned PDFs and an AI vision API for low-quality scans.

Originally built for [CRAG](https://github.com/crag-lmt/crag-lmt) (regulatory compliance intelligence) and extracted as a standalone library.

## Install

```bash
npm install @crag-pro/doc-parser
```

## Quick start

```ts
import { parse } from "@crag-pro/doc-parser";

const result = await parse("./contract.pdf");
console.log(result.text);
console.log(result.metadata);
```

## Supported formats

| Extension | Parser | Notes |
|---|---|---|
| `.pdf` | pdf-parse | OCR fallback (Tesseract) for scanned pages, AI vision API for low-confidence OCR |
| `.docx` | mammoth | |
| `.xlsx`, `.xls` | exceljs / xlsx | |
| `.pptx` | XML extraction | |
| `.txt`, `.csv`, `.md`, `.msg` | plaintext | |

## CLI

```bash
npx @crag-pro/doc-parser ./input-dir ./output-dir
```

See `doc-parser --help` for full options.

## OCR setup (optional)

Tesseract must be installed locally for OCR fallback:

```bash
# macOS
brew install tesseract

# Ubuntu
apt-get install tesseract-ocr
```

For AI vision fallback on low-quality scans, set `ANTHROPIC_API_KEY` in your environment.

## License

MIT
