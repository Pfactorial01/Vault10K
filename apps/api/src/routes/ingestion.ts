import type { Express } from "express";
import { IngestionJobModel } from "../models/ingestionJob.js";
import { triggerQueue } from "../services/ingestionRunner.js";

export function registerIngestion(app: Express): void {
  app.post("/api/ingestion/jobs", async (req, res) => {
    const body = req.body as {
      ticker?: string;
      cik?: string;
      reportYear?: number;
      force?: boolean;
    };
    const raw = (body.ticker ?? body.cik ?? "").toString().trim();
    if (!raw) {
      res.status(400).json({ error: "ticker or cik required" });
      return;
    }
    const job = await IngestionJobModel.create({
      ticker: raw,
      reportYear:
        body.reportYear !== undefined ? Number(body.reportYear) : undefined,
      force: Boolean(body.force),
      status: "queued",
      stage: "queued",
    });
    triggerQueue();
    res.status(202).json({ jobId: String(job._id) });
  });

  app.get("/api/ingestion/jobs/:id", async (req, res) => {
    const j = await IngestionJobModel.findById(String(req.params.id)).lean();
    if (!j || Array.isArray(j)) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const job = j as unknown as {
      _id: { toString(): string };
      status: string;
      stage: string;
      ticker: string;
      cik?: string;
      reportYear?: number;
      force?: boolean;
      error?: string;
      bytesDownloaded?: number;
      localFile?: string;
      filingId?: { toString(): string };
      skipped?: boolean;
      skipReason?: string;
      createdAt?: Date;
      updatedAt?: Date;
    };
    res.json({
      id: String(job._id),
      status: job.status,
      stage: job.stage,
      ticker: job.ticker,
      cik: job.cik,
      reportYear: job.reportYear,
      force: job.force,
      error: job.error,
      bytesDownloaded: job.bytesDownloaded,
      localFile: job.localFile,
      filingId: job.filingId ? String(job.filingId) : undefined,
      skipped: job.skipped,
      skipReason: job.skipReason,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  });

  app.get("/api/ingestion/jobs", async (req, res) => {
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20)
    );
    const jobs = await IngestionJobModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({
      jobs: jobs.map((j) => ({
        id: String(j._id),
        status: j.status,
        stage: j.stage,
        ticker: j.ticker,
        error: j.error,
        bytesDownloaded: j.bytesDownloaded,
        skipped: j.skipped,
        createdAt: j.createdAt,
      })),
    });
  });
}
