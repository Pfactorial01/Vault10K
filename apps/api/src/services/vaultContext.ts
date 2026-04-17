import { FilingModel } from "../models/filing.js";

export type VaultStats = {
  filingCount: number;
  byTicker: Record<string, number>;
};

export async function getVaultStats(): Promise<VaultStats> {
  const filingCount = await FilingModel.countDocuments();
  const rows = await FilingModel.aggregate<{ _id: string; n: number }>([
    { $group: { _id: "$ticker", n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const byTicker: Record<string, number> = {};
  for (const r of rows) {
    if (r._id) byTicker[String(r._id).toUpperCase()] = r.n;
  }
  return { filingCount, byTicker };
}

/**
 * One-line context for the LLM (scope of indexed data).
 */
export function vaultSummaryLine(stats: VaultStats): string {
  if (stats.filingCount === 0) {
    return "Indexed filings in this workspace: none yet.";
  }
  const tickers = Object.keys(stats.byTicker).sort().join(", ");
  return `Indexed filings in this workspace: ${stats.filingCount} (tickers: ${tickers}).`;
}

/**
 * Questions about the Vault app / indexed corpus (not 10-K paragraph content).
 */
function looksLikeVaultMetaQuestion(q: string): boolean {
  const s = q.toLowerCase();
  const hasFilingWord =
    /\b(filing|filings|filling|fillings)\b/.test(s) ||
    /\b10[- ]?k\b/.test(s);

  if (
    /\b(how many|what is the (number|count)|number of|count of|total)\b/.test(
      s
    ) &&
    hasFilingWord
  ) {
    return true;
  }
  if (
    hasFilingWord &&
    /\b(we have|i have|indexed|loaded|ingested|stored|in (the )?(system|vault|app|database))\b/.test(
      s
    )
  ) {
    return true;
  }
  if (
    /\b(list|what are|which|show)\b/.test(s) &&
    hasFilingWord &&
    /\b(indexed|available|have|loaded)\b/.test(s)
  ) {
    return true;
  }
  if (
    /\b(what|which)\b/.test(s) &&
    /\b(filing|filings|ticker|tickers|compan(y|ies))\b/.test(s) &&
    /\b(indexed|available|in (the )?(vault|system))\b/.test(s)
  ) {
    return true;
  }
  return false;
}

/**
 * Direct answer from Mongo — no vector RAG. Empty citations in caller.
 */
export async function tryAnswerVaultMetaQuestion(
  query: string
): Promise<{ answer: string } | null> {
  if (!looksLikeVaultMetaQuestion(query)) return null;

  const stats = await getVaultStats();
  if (stats.filingCount === 0) {
    return {
      answer:
        "There are **no** Form 10-K filings indexed in this workspace yet. Go to **Ingestion** to download and process filings; after that, you can ask questions about their content here.",
    };
  }

  const lines = Object.entries(stats.byTicker)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([t, n]) => `- **${t}**: ${n} filing${n === 1 ? "" : "s"}`);

  return {
    answer: [
      `This workspace currently has **${stats.filingCount}** indexed Form 10-K filing${stats.filingCount === 1 ? "" : "s"}:`,
      "",
      ...lines,
      "",
      "Ask about a specific company, section (e.g. risk factors, MD&A), or figures — answers are retrieved from those filing chunks.",
    ].join("\n"),
  };
}
