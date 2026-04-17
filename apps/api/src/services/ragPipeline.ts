import OpenAI from "openai";
import { config } from "../config.js";
import {
  getCachedAnswer,
  setCachedAnswer,
  type CachedAnswer,
} from "../cache/semanticCache.js";
import { embedQuery } from "../pipeline/embed.js";
import { searchChunks } from "../qdrant.js";
import {
  augmentQueryForEmbedding,
  sectionIntentBoost,
  wantsRiskFactorContent,
} from "./ragQueryHints.js";
import {
  getVaultStats,
  tryAnswerVaultMetaQuestion,
  vaultSummaryLine,
} from "./vaultContext.js";

export type CitationPayload = {
  chunkId: string;
  ticker: string;
  year: number;
  section: string;
  excerpt: string;
  charStart: number;
  charEnd: number;
  filingId?: string;
};

export type ChatHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

const RETRIEVAL_POOL = 16;
const RETRIEVAL_POOL_RISK = 24;
const MAX_CONTEXT_CHUNKS = 8;
const MIN_EXCERPT_LEN = 35;

type RawHit = {
  id: string;
  score: number;
  payload: Record<string, unknown>;
};

/** Down-rank HTML table dumps and tiny fragments (common in 10-K chunking). */
function excerptQualityPenalty(excerpt: string): number {
  const t = excerpt.replace(/\s+/g, " ").trim();
  if (t.length < MIN_EXCERPT_LEN) return 0.35;
  const pipeCount = (t.match(/\|/g) ?? []).length;
  const pipeDensity = pipeCount / Math.max(t.length, 1);
  if (pipeDensity > 0.07) return 0.45;
  if (pipeDensity > 0.035) return 0.72;
  return 1;
}

function selectContextChunks(hits: RawHit[], query: string): RawHit[] {
  if (hits.length === 0) return [];
  const scored = hits.map((h, i) => {
    const ex = String(h.payload.excerpt ?? "");
    const q = excerptQualityPenalty(ex);
    const sec = String(h.payload.section ?? "");
    const boost = sectionIntentBoost(sec, query);
    const combined = (h.score ?? 0) * q * boost + i * 0.0001;
    return { hit: h, combined };
  });
  scored.sort((a, b) => b.combined - a.combined);
  const filtered = scored.filter((s) => s.combined > 0.08);
  const pool = filtered.length >= 4 ? filtered : scored;
  return pool.slice(0, MAX_CONTEXT_CHUNKS).map((s) => s.hit);
}

const SYSTEM_PROMPT = `You are Vault10K, an assistant for research on SEC Form 10-K filings stored in this workspace.

Rules:
- Ground statements about companies, risks, financials, or filing text ONLY in the numbered excerpts below. Reference them as [1], [2], … matching the excerpt numbers.
- A one-line VAULT SCOPE line describes how many filings are indexed here—it is NOT text from inside a 10-K. Use it only for context about coverage; do not treat it as issuer disclosure.
- Excerpts are short snippets and may include tables, headings, or OCR-like pipes. If excerpts are unclear, fragmented, or off-topic, say so briefly—do not invent numbers, prices, or filing facts.
- Be direct and readable: short paragraphs, numbered points when listing multiple items. Prefer synthesis over repeating long table fragments.
- Do not give personalized investment advice or price targets. For buy/sell or valuation questions, explain what the excerpts do or do not show, cite limitations, and note that you are not a financial advisor.
- If excerpts do not contain enough information to answer, say what is missing and suggest narrowing the question (e.g. by ticker or section).
- Retrieval is often scoped to a single issuer when the user names one ticker (or sets the thread ticker filter)—keep the answer focused on that issuer unless excerpts explicitly span multiple companies.

For **Item 1A / risk factor** questions:
- Produce a structured answer: **bold-style short titles** (using **title**) per theme, then 1–3 sentences each, grounded in excerpts with [n] citations.
- Cover **distinct** risks; if multiple excerpts repeat the same theme, merge into one bullet instead of repeating.
- Acknowledge briefly that excerpts are partial and the full Item 1A in the filed 10-K is the complete list.
- Do not list generic filler as if it were a separate risk unless the excerpt substantively adds a new hazard or constraint.`;

/**
 * Stateless RAG: retrieve chunks, optionally continue a multi-turn dialog.
 */
export async function runRagPipeline(
  openai: OpenAI,
  query: string,
  opts: {
    ticker?: string;
    year?: number;
    useSemanticCache?: boolean;
    history?: ChatHistoryTurn[];
  }
): Promise<{ answer: string; citations: CitationPayload[]; cached: boolean }> {
  const vaultDirect = await tryAnswerVaultMetaQuestion(query);
  if (vaultDirect) {
    return {
      answer: vaultDirect.answer,
      citations: [],
      cached: false,
    };
  }

  const useCache = opts.useSemanticCache !== false;

  const cacheParts = {
    query,
    ticker: opts.ticker,
    year: opts.year,
    model: config.openaiChatModel,
  };

  if (useCache && (!opts.history || opts.history.length === 0)) {
    const cached = await getCachedAnswer(cacheParts);
    if (cached) {
      return {
        answer: cached.answer,
        citations: cached.citations as CitationPayload[],
        cached: true,
      };
    }
  }

  const stats = await getVaultStats();
  const scopeLine = vaultSummaryLine(stats);

  const embedText = augmentQueryForEmbedding(query);
  const vector = await embedQuery(embedText);
  const poolSize = wantsRiskFactorContent(query)
    ? RETRIEVAL_POOL_RISK
    : RETRIEVAL_POOL;
  const rawHits = (await searchChunks(vector, poolSize, {
    ticker: opts.ticker,
    year: opts.year,
  })) as RawHit[];

  const hits = selectContextChunks(rawHits, query);

  const contextBlocks = hits.map((h, i) => {
    const p = h.payload;
    const ex = String(p.excerpt ?? "");
    const sec = String(p.section ?? "Unknown");
    return `[${i + 1}] ticker=${p.ticker} year=${p.year} section=${sec}\n${ex}`;
  });

  const riskExtra = wantsRiskFactorContent(query)
    ? `

Focus: This question targets **Item 1A Risk Factors**. Prioritize themes clearly supported by the excerpts; avoid padding with unrelated boilerplate. End with one sentence that the complete risk-factor discussion appears in the full 10-K filing.`
    : "";

  const userPrompt = `${scopeLine}

User question:
${query}

Relevant 10-K excerpts (cite as [1]…[${hits.length}] when stating a fact from a passage):
${contextBlocks.length ? contextBlocks.join("\n\n---\n\n") : "(No matching chunks passed filters—indexed text may be sparse for this query or filters.)"}

Instructions: Answer using the excerpts above.${riskExtra}

If the question is fully answered by VAULT SCOPE alone, keep the reply short.`;

  const historyMessages: OpenAI.Chat.ChatCompletionMessageParam[] = (
    opts.history ?? []
  )
    .slice(-12)
    .map((h) => ({
      role: h.role,
      content: h.content,
    }));

  const completion = await openai.chat.completions.create({
    model: config.openaiChatModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...historyMessages,
      { role: "user", content: userPrompt },
    ],
    temperature: 0.15,
    max_tokens: wantsRiskFactorContent(query) ? 2688 : 2048,
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? "";

  const citations: CitationPayload[] = hits.map((h) => {
    const p = h.payload;
    return {
      chunkId: String(p.chunkId ?? ""),
      ticker: String(p.ticker ?? ""),
      year: Number(p.year ?? 0),
      section: String(p.section ?? ""),
      excerpt: String(p.excerpt ?? ""),
      charStart: Number(p.charStart ?? 0),
      charEnd: Number(p.charEnd ?? 0),
      filingId: p.filingId ? String(p.filingId) : undefined,
    };
  });

  if (useCache && (!opts.history || opts.history.length === 0)) {
    const payload: CachedAnswer = { answer, citations };
    await setCachedAnswer(cacheParts, payload);
  }

  return { answer, citations, cached: false };
}
