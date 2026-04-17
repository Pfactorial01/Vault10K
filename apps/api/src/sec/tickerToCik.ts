import { secFetch } from "./http.js";

export type TickerRow = { cik_str: number; ticker: string; title: string };

let cache: Map<string, TickerRow> | null = null;

export async function loadCompanyTickers(): Promise<Map<string, TickerRow>> {
  if (cache) return cache;
  const res = await secFetch("https://www.sec.gov/files/company_tickers.json");
  if (!res.ok) {
    throw new Error(`SEC company_tickers: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as Record<string, TickerRow>;
  const m = new Map<string, TickerRow>();
  for (const k of Object.keys(data)) {
    const row = data[k];
    m.set(row.ticker.toUpperCase(), row);
  }
  cache = m;
  return m;
}

export async function resolveCikFromTicker(ticker: string): Promise<TickerRow> {
  const map = await loadCompanyTickers();
  const row = map.get(ticker.trim().toUpperCase());
  if (!row) {
    throw new Error(`Unknown ticker: ${ticker}`);
  }
  return row;
}

export function padCik(cik: number | string): string {
  const n = typeof cik === "string" ? parseInt(cik, 10) : cik;
  return String(n).padStart(10, "0");
}

/** Autocomplete for ingestion UI: prefix match on ticker, then substring on ticker/title. */
export async function searchTickers(
  raw: string,
  limit = 25
): Promise<{ ticker: string; title: string }[]> {
  const q = raw.trim();
  if (q.length < 1) return [];
  if (/^\d+$/.test(q)) return [];

  const query = q.toUpperCase();
  const map = await loadCompanyTickers();
  const candidates: { ticker: string; title: string; score: number }[] = [];

  for (const row of map.values()) {
    const t = row.ticker.toUpperCase();
    const titleU = row.title.toUpperCase();
    let score = 100;
    if (t === query) score = 0;
    else if (t.startsWith(query)) score = 1;
    else if (t.includes(query)) score = 2;
    else if (titleU.includes(query)) score = 3;
    else continue;
    candidates.push({ ticker: row.ticker, title: row.title, score });
  }

  candidates.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.ticker.localeCompare(b.ticker);
  });

  const seen = new Set<string>();
  const out: { ticker: string; title: string }[] = [];
  for (const c of candidates) {
    if (seen.has(c.ticker)) continue;
    seen.add(c.ticker);
    out.push({ ticker: c.ticker, title: c.title });
    if (out.length >= limit) break;
  }
  return out;
}
