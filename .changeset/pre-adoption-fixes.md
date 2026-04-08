---
"@crag-pro/doc-parser": minor
---

Fix 4 pre-adoption blockers:
- OCR: throw on empty AI vision response instead of returning empty string
- PPTX: surface warning on missing slides directory instead of silent empty
- Plaintext: handle non-UTF8 encodings with fallback + warning
- All parsers: enforce 500MB file size limit to prevent OOM
