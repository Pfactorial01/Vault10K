import type { Express } from "express";
import OpenAI from "openai";
import { config } from "../config.js";
import { runRagPipeline } from "../services/ragPipeline.js";
import { resolveRetrievalTicker } from "../services/tickerFromQuery.js";
import { getVaultStats } from "../services/vaultContext.js";

export function registerAsk(app: Express): void {
  const openai = config.openaiApiKey
    ? new OpenAI({ apiKey: config.openaiApiKey })
    : null;

  app.post("/api/ask", async (req, res) => {
    const body = req.body as {
      query?: string;
      ticker?: string;
      year?: number;
    };
    const query = body.query?.trim();
    if (!query) {
      res.status(400).json({ error: "query required" });
      return;
    }

    if (!openai) {
      res.status(503).json({ error: "OPENAI_API_KEY not configured" });
      return;
    }

    const stats = await getVaultStats();
    const indexedTickers = Object.keys(stats.byTicker);
    const ticker = resolveRetrievalTicker(
      query,
      indexedTickers,
      body.ticker?.trim() ?? ""
    );

    const { answer, citations, cached } = await runRagPipeline(openai, query, {
      ticker,
      year: body.year,
      useSemanticCache: true,
    });

    res.json({ answer, citations, cached });
  });
}
