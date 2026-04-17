import type { Express } from "express";
import mongoose from "mongoose";
import { config } from "../config.js";
import { pingRedis } from "../cache/semanticCache.js";
import { getQdrant } from "../qdrant.js";

export function registerHealth(app: Express): void {
  app.get("/health", async (_req, res) => {
    const mongoOk = mongoose.connection.readyState === 1;
    let qdrantOk = false;
    try {
      const c = await getQdrant();
      await c.getCollections();
      qdrantOk = true;
    } catch {
      qdrantOk = false;
    }
    const redisOk = config.redisEnabled ? await pingRedis() : null;
    const ok = mongoOk && qdrantOk;
    res.status(ok ? 200 : 503).json({
      ok,
      mongo: mongoOk,
      qdrant: qdrantOk,
      redis: redisOk,
    });
  });
}
