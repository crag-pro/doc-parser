# @crag-pro/doc-parser

## 0.3.0-crag.1

### Minor Changes

- Edge-case test corpus (25 tests, 24 synthetic fixtures) and 7 bug fixes:

  - fix(plaintext): detect encoding via BOM and jschardet, decode via iconv-lite (fixes UTF-16 LE/BE BOM mojibake, Windows-1252 smart quotes)
  - fix(xlsx): resolve formula results, ISO-format dates, dedupe merged cells
  - fix(pdf): replace abandoned pdf-parse with unpdf for modern PDF compatibility
  - fix(xlsx): stream-parse to avoid event-loop hang on full-column dataValidations (Dynamics/PowerApps exports)

## 0.3.0-crag.0

### Minor Changes

- Fix 4 pre-adoption blockers:
  - OCR: throw on empty AI vision response instead of returning empty string
  - PPTX: surface warning on missing slides directory instead of silent empty
  - Plaintext: handle non-UTF8 encodings with fallback + warning
  - All parsers: enforce 500MB file size limit to prevent OOM

## 0.2.0

### Minor Changes

- bb807b2: Initial public release extracted from crag-lmt monorepo.
