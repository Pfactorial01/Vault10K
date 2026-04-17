import type { Express } from "express";
import { searchTickers } from "../sec/tickerToCik.js";

export function registerTickers(app: Express): void {
  app.get("/api/tickers", async (req, res) => {
    const q = String(req.query.q ?? "");
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25)
    );
    try {
      const tickers = await searchTickers(q, limit);
      res.json({ tickers });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(503).json({ error: msg });
    }
  });
}
