import fs from "node:fs/promises";
import { extractPrimary10kHtml, normalizeDisplayHtml } from "./extract.js";

/** Sidecar next to the SEC full-submission `.txt` download. */
export function primaryHtmlPathFromLocalFile(localFile: string): string {
  return /\.txt$/i.test(localFile)
    ? localFile.replace(/\.txt$/i, ".primary.html")
    : `${localFile}.primary.html`;
}

/**
 * Read cached primary 10-K HTML, or extract from the raw submission once and
 * write the sidecar (helps filings ingested before HTML was persisted).
 */
export async function getPrimaryHtmlForFiling(
  localFile: string,
  primaryHtmlFile?: string | null
): Promise<string> {
  const path = primaryHtmlFile ?? primaryHtmlPathFromLocalFile(localFile);
  try {
    const cached = await fs.readFile(path, "utf8");
    const normalized = normalizeDisplayHtml(cached);
    if (normalized !== cached) {
      await fs.writeFile(path, normalized, "utf8");
    }
    return normalized;
  } catch {
    const raw = await fs.readFile(localFile, "utf8");
    const html = extractPrimary10kHtml(raw);
    const out = primaryHtmlPathFromLocalFile(localFile);
    await fs.writeFile(out, html, "utf8");
    return html;
  }
}
