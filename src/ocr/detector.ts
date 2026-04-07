const MIN_CHARS_PER_PAGE = 100;

export function isScanned(text: string, pageCount: number | null): boolean {
  if (pageCount === null) return false;
  if (pageCount === 0) return true;
  return text.length / pageCount < MIN_CHARS_PER_PAGE;
}
