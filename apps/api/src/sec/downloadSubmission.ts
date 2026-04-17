import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { secFetch } from "./http.js";

/**
 * SEC stores the full submission under the accession folder using either:
 * - `{accession}_full.txt` (older / some forms), or
 * - `{accession}.txt` (common for current 10-K packages — see directory index.json).
 */
export function submissionDownloadUrls(
  cikNumeric: number,
  accession: string
): string[] {
  const accNoDash = accession.replace(/-/g, "");
  const base = `https://www.sec.gov/Archives/edgar/data/${cikNumeric}/${accNoDash}/`;
  return [`${base}${accession}_full.txt`, `${base}${accession}.txt`];
}

/** @deprecated Prefer submissionDownloadUrls — kept for callers that need a primary URL. */
export function submissionArchiveUrl(
  cikNumeric: number,
  accession: string
): string {
  return submissionDownloadUrls(cikNumeric, accession)[0];
}

/** `{TICKER}_10-K_report-{report}_filed-{fdate}.txt` — dates use YYYY-MM-DD. */
export function localFilename(
  ticker: string,
  reportDate: string,
  filingDate: string
): string {
  const t = ticker.toUpperCase();
  return `${t}_10-K_report-${reportDate}_filed-${filingDate}.txt`;
}

export async function downloadFullSubmissionToFile(opts: {
  cikNumeric: number;
  ticker: string;
  accession: string;
  reportDate: string;
  filingDate: string;
}): Promise<{ localPath: string; bytes: number }> {
  const urls = submissionDownloadUrls(opts.cikNumeric, opts.accession);
  let lastStatus = "";
  for (const url of urls) {
    const res = await secFetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.mkdir(config.filingsDataDir, { recursive: true });
      const name = localFilename(
        opts.ticker,
        opts.reportDate,
        opts.filingDate
      );
      const localPath = path.join(config.filingsDataDir, name);
      await fs.writeFile(localPath, buf);
      return { localPath, bytes: buf.length };
    }
    lastStatus = `${res.status} ${res.statusText}`;
  }
  const tried = urls.map((u) => u.split("/").pop()).join(", ");
  throw new Error(
    `SEC download failed for ${opts.accession} (tried ${tried}): ${lastStatus}`
  );
}
