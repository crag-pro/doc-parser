# @crag-pro/doc-parser

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
