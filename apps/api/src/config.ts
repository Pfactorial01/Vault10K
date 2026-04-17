import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

/** Fiscal year: report date month-day implies fiscal year ending in calendar year of reportDate (documented rule). */
export const FISCAL_YEAR_RULE =
  "Fiscal year is the calendar year containing the reportDate (e.g. report 2025-01-26 → FY2025).";

function envString(name: string, fallback: string): string {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v : fallback;
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const config = {
  port: envInt("PORT", 3001),
  nodeEnv: envString("NODE_ENV", "development"),
  mongoUri: envString("MONGODB_URI", "mongodb://127.0.0.1:27017/vault10k"),
  qdrantUrl: envString("QDRANT_URL", "http://127.0.0.1:6333"),
  qdrantCollection: envString("QDRANT_COLLECTION", "vault10k_chunks"),
  redisUrl: envString("REDIS_URL", "redis://127.0.0.1:6379"),
  redisEnabled: envBool("REDIS_ENABLED", true),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiChatModel: envString("OPENAI_CHAT_MODEL", "gpt-4o"),
  filingsDataDir: path.resolve(envString("FILINGS_DATA_DIR", "./data/filings")),
  secUserAgent: envString(
    "SEC_USER_AGENT",
    "Vault10K/1.0 (contact@example.com)"
  ),
  secSleepMs: envInt("SEC_SLEEP_MS", 100),
  chunkSize: envInt("CHUNK_SIZE", 1500),
  chunkOverlap: envInt("CHUNK_OVERLAP", 300),
  webOrigin: envString("WEB_ORIGIN", "http://localhost:5173"),
  /** fastembed EmbeddingModel enum key, e.g. BGESmallENV15 */
  fastembedModelKey: envString("FASTEMBED_MODEL", "BGESmallENV15"),
};
