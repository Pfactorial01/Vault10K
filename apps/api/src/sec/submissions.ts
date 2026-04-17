import { secFetch } from "./http.js";
import { padCik } from "./tickerToCik.js";

export type RecentFilings = {
  form: string[];
  filingDate: string[];
  accessionNumber: string[];
  reportDate?: string[];
  primaryDocument?: string[];
};

export type SubmissionsJson = {
  cik: string;
  name: string;
  tickers?: string[];
  filings: { recent: RecentFilings };
};

export async function fetchSubmissions(cikNumeric: number): Promise<SubmissionsJson> {
  const padded = padCik(cikNumeric);
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const res = await secFetch(url);
  if (!res.ok) {
    throw new Error(`SEC submissions ${padded}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as SubmissionsJson;
}

export type TenKMatch = {
  accession: string;
  filingDate: string;
  reportDate: string;
  form: string;
};

/**
 * Picks the most recent Form 10-K (not 10-K/A unless no 10-K) matching optional fiscal report year.
 * Report year: calendar year of reportDate (aligned with plan fiscal-year rule).
 */
export function findTenK(
  recent: RecentFilings,
  reportYear?: number
): TenKMatch | null {
  const n = recent.form?.length ?? 0;
  const candidates: TenKMatch[] = [];
  for (let i = 0; i < n; i++) {
    const form = recent.form[i];
    if (form !== "10-K" && form !== "10-K/A") continue;
    const accession = recent.accessionNumber[i];
    const filingDate = recent.filingDate[i];
    const reportDate =
      recent.reportDate?.[i] && recent.reportDate[i] !== ""
        ? recent.reportDate[i]
        : filingDate;
    candidates.push({ accession, filingDate, reportDate, form });
  }
  if (candidates.length === 0) return null;

  const filtered =
    reportYear === undefined
      ? candidates
      : candidates.filter((c) => {
          const y = yearFromReportDate(c.reportDate);
          return y === reportYear;
        });

  const list = filtered.length > 0 ? filtered : candidates;
  list.sort((a, b) => (a.filingDate < b.filingDate ? 1 : -1));
  const prefer = list.find((x) => x.form === "10-K") ?? list[0];
  return prefer;
}

function yearFromReportDate(reportDate: string): number {
  const y = parseInt(reportDate.slice(0, 4), 10);
  return Number.isFinite(y) ? y : 0;
}
