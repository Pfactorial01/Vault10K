import fs from "node:fs/promises";
import type { Express } from "express";
import { FilingModel } from "../models/filing.js";
import {
  getPrimaryHtmlForFiling,
  primaryHtmlPathFromLocalFile,
} from "../pipeline/primaryHtmlFile.js";

export function registerFilings(app: Express): void {
  app.get("/api/filings", async (req, res) => {
    const ticker = req.query.ticker
      ? String(req.query.ticker).toUpperCase()
      : undefined;
    const q = ticker ? { ticker } : {};
    const rows = await FilingModel.find(q)
      .sort({ reportDate: -1 })
      .select({
        ticker: 1,
        companyName: 1,
        reportDate: 1,
        filingDate: 1,
        accession: 1,
        localFile: 1,
        createdAt: 1,
      })
      .lean();
    res.json({
      filings: rows.map((r) => ({
        id: String(r._id),
        ticker: r.ticker,
        companyName: r.companyName,
        reportDate: r.reportDate,
        filingDate: r.filingDate,
        accession: r.accession,
        localFile: r.localFile,
        createdAt: r.createdAt,
      })),
    });
  });

  app.get("/api/filings/:id/html", async (req, res) => {
    const f = await FilingModel.findById(String(req.params.id)).lean();
    if (!f || Array.isArray(f)) {
      res.status(404).type("text/plain").send("not found");
      return;
    }
    const doc = f as unknown as {
      localFile: string;
      primaryHtmlFile?: string;
    };
    try {
      const html = await getPrimaryHtmlForFiling(
        doc.localFile,
        doc.primaryHtmlFile
      );
      if (!doc.primaryHtmlFile) {
        await FilingModel.findByIdAndUpdate(req.params.id, {
          primaryHtmlFile: primaryHtmlPathFromLocalFile(doc.localFile),
        });
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(html);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).type("text/plain").send(msg);
    }
  });

  app.get("/api/filings/:id/text", async (req, res) => {
    const f = await FilingModel.findById(String(req.params.id)).lean();
    if (!f || Array.isArray(f)) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const doc = f as unknown as {
      _id: { toString(): string };
      ticker: string;
      companyName: string;
      reportDate: string;
      filingDate: string;
      accession: string;
      scrubbedText?: string;
      scrubbedFile?: string;
      chunkMarkers: unknown[];
    };
    let text = "";
    if (doc.scrubbedText) {
      text = doc.scrubbedText;
    } else if (doc.scrubbedFile) {
      text = await fs.readFile(doc.scrubbedFile, "utf8");
    }
    res.json({
      id: String(doc._id),
      ticker: doc.ticker,
      companyName: doc.companyName,
      reportDate: doc.reportDate,
      filingDate: doc.filingDate,
      accession: doc.accession,
      text,
      chunkMarkers: doc.chunkMarkers,
    });
  });
}
