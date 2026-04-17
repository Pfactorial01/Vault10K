/**
 * Intent hints for retrieval ranking and query embedding augmentation.
 */

/** User is likely asking about Form 10-K Item 1A (Risk Factors). */
export function wantsRiskFactorContent(query: string): boolean {
  return /\b(risk\s*factors?|item\s*1\s*a|item\s*1a|1\s*a\.?\s*risk|part\s*i\s*,?\s*item\s*1a)\b/i.test(
    query
  );
}

/**
 * Appends domain phrasing so the embedding aligns with Item 1A narrative chunks.
 */
export function augmentQueryForEmbedding(original: string): string {
  const q = original.trim();
  if (!q) return q;
  if (wantsRiskFactorContent(q)) {
    return `${q}\n\nSEC Form 10-K Part I Item 1A Risk Factors — qualitative risk disclosures.`;
  }
  return q;
}

/**
 * Multiplier for reranking: boost chunks whose section label matches the question intent.
 */
export function sectionIntentBoost(section: string, query: string): number {
  const sec = section.toLowerCase();
  if (wantsRiskFactorContent(query)) {
    if (/risk\s*factor|item\s*1a|^1a\.|part\s*i.*1a/i.test(sec)) return 1.32;
    if (
      /cyber|data\s*privacy|security\s*breach|competition|litigation|regulatory|intellectual\s*property/i.test(
        sec
      ) &&
      /risk|factor|security|privacy/i.test(sec)
    ) {
      return 1.12;
    }
    if (
      /\bunknown\b|exhibit|table\s*of\s*contents|market\s*for\s*registrant/i.test(
        sec
      )
    ) {
      return 0.82;
    }
    return 1;
  }
  return 1;
}
