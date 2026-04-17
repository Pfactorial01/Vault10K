import crypto from "node:crypto";
import Redis from "ioredis";
import { config } from "../config.js";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!config.redisEnabled) return null;
  if (!redis) {
    redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2 });
  }
  return redis;
}

export type CachedAnswer = {
  answer: string;
  citations: {
    chunkId: string;
    ticker: string;
    year: number;
    section: string;
    excerpt: string;
    charStart: number;
    charEnd: number;
    filingId?: string;
  }[];
};

function cacheKey(parts: {
  query: string;
  ticker?: string;
  year?: number;
  model: string;
}): string {
  const norm = parts.query.trim().toLowerCase().replace(/\s+/g, " ");
  const h = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        q: norm,
        ticker: parts.ticker?.toUpperCase(),
        year: parts.year,
        model: parts.model,
      })
    )
    .digest("hex");
  return `vault10k:rag:${h}`;
}

export async function getCachedAnswer(
  parts: Parameters<typeof cacheKey>[0]
): Promise<CachedAnswer | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(cacheKey(parts));
    if (!raw) return null;
    return JSON.parse(raw) as CachedAnswer;
  } catch {
    return null;
  }
}

export async function setCachedAnswer(
  parts: Parameters<typeof cacheKey>[0],
  value: CachedAnswer,
  ttlSec = 86400 * 2
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(cacheKey(parts), JSON.stringify(value), "EX", ttlSec);
  } catch {
    /* ignore */
  }
}

export async function pingRedis(): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  try {
    const p = await r.ping();
    return p === "PONG";
  } catch {
    return false;
  }
}
