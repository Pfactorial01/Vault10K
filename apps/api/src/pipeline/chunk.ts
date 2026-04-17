export type TextChunk = {
  chunkIndex: number;
  text: string;
  charStart: number;
  charEnd: number;
};

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

export function recursiveChunk(
  text: string,
  chunkSize: number,
  overlap: number,
  separators: string[] = DEFAULT_SEPARATORS
): TextChunk[] {
  if (chunkSize <= 0) throw new Error("chunkSize must be positive");
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error("overlap must be >= 0 and < chunkSize");
  }
  const out: TextChunk[] = [];
  let start = 0;
  let idx = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const splitAt = findBestSplit(window, separators);
      if (splitAt > 0) {
        end = start + splitAt;
      }
    }
    const raw = text.slice(start, end);
    const t = raw.trim();
    if (t.length === 0) {
      start = end >= text.length ? text.length : end;
      continue;
    }
    const rel = raw.indexOf(t[0]);
    const charStart = start + (rel >= 0 ? rel : 0);
    const charEnd = charStart + t.length;
    out.push({ chunkIndex: idx++, text: t, charStart, charEnd });
    const next = end - overlap;
    start = next > start ? next : end;
    if (start >= text.length) break;
    if (start <= charStart) start = end;
  }
  return out;
}

function findBestSplit(slice: string, separators: string[]): number {
  for (const sep of separators) {
    const idx = slice.lastIndexOf(sep);
    if (idx > slice.length * 0.25 && idx < slice.length - 1) {
      return idx + sep.length;
    }
  }
  return slice.length;
}
