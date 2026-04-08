---
"@crag-pro/doc-parser": minor
---

Edge-case test corpus (25 tests, 24 synthetic fixtures) and 7 bug fixes:

- fix(plaintext): detect encoding via BOM and jschardet, decode via iconv-lite (fixes UTF-16 LE/BE BOM mojibake, Windows-1252 smart quotes)
- fix(xlsx): resolve formula results, ISO-format dates, dedupe merged cells
- fix(pdf): replace abandoned pdf-parse with unpdf for modern PDF compatibility
- fix(xlsx): stream-parse to avoid event-loop hang on full-column dataValidations (Dynamics/PowerApps exports)
