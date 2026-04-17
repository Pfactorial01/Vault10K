/**
 * Detects indexed ticker symbols in the user query so retrieval can filter Qdrant
 * even when the conversation "Ticker filter" field is empty.
 *
 * - If exactly one indexed ticker appears as a whole word → use it for retrieval.
 * - If zero → fall back to the conversation's saved ticker filter.
 * - If two or more → no auto-filter (comparison / multi-company questions).
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns unique tickers mentioned in `query` (whole-word, case-insensitive)
 * among `indexedTickers` (longer symbols first to reduce ambiguity).
 */
export function tickersMentionedInQuery(
  query: string,
  indexedTickers: string[]
): string[] {
  const unique = [...new Set(indexedTickers.map((t) => t.toUpperCase()))];
  unique.sort((a, b) => b.length - a.length);
  const found: string[] = [];
  for (const t of unique) {
    const re = new RegExp(`\\b${escapeRegExp(t)}\\b`, "i");
    if (re.test(query)) found.push(t);
  }
  return found;
}

export function resolveRetrievalTicker(
  query: string,
  indexedTickers: string[],
  conversationTicker?: string
): string | undefined {
  const mentioned = tickersMentionedInQuery(query, indexedTickers);
  if (mentioned.length === 1) {
    return mentioned[0];
  }
  if (mentioned.length === 0) {
    const c = conversationTicker?.trim();
    return c ? c.toUpperCase() : undefined;
  }
  return undefined;
}
