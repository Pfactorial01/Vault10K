import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { config } from "./config.js";
import { ensureCollection } from "./qdrant.js";
import { registerAsk } from "./routes/ask.js";
import { registerChats } from "./routes/chats.js";
import { registerFilings } from "./routes/filings.js";
import { registerHealth } from "./routes/health.js";
import { registerIngestion } from "./routes/ingestion.js";
import { registerTickers } from "./routes/tickers.js";

async function main(): Promise<void> {
  await mongoose.connect(config.mongoUri);
  await ensureCollection();

  const app = express();
  app.use(cors({ origin: config.webOrigin, credentials: true }));
  app.use(express.json({ limit: "10mb" }));

  registerHealth(app);
  registerTickers(app);
  registerIngestion(app);
  registerFilings(app);
  registerChats(app);
  registerAsk(app);

  const webDist = path.join(process.cwd(), "apps/web/dist");
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        res.status(404).json({ error: "not found" });
        return;
      }
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  app.listen(config.port, () => {
    console.log(`Vault10K API listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
