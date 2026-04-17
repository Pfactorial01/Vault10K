import crypto from "node:crypto";
import fs from "node:fs/promises";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { deletePointsByFilingId, upsertChunks } from "../qdrant.js";
import { FilingModel } from "../models/filing.js";
import { recursiveChunk } from "./chunk.js";
import { embedPassages } from "./embed.js";
import { extractPrimary10kHtml } from "./extract.js";
import { primaryHtmlPathFromLocalFile } from "./primaryHtmlFile.js";
import { detectItemSections, sectionAtOffset } from "./sections.js";
import { scrubHtmlToText } from "./scrub.js";

export type IngestInput = {
  ticker: string;
  cikNumeric: number;
  companyName: string;
  reportDate: string;
  filingDate: string;
  accession: string;
  localFile: string;
  force?: boolean;
};

export function fiscalYearFromReportDate(reportDate: string): number {
  return parseInt(reportDate.slice(0, 4), 10);
}

function hashText(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

export async function ingestFilingFromLocalFile(
  input: IngestInput
): Promise<{ filingId: string; skipped: boolean; reason?: string }> {
  const raw = await fs.readFile(input.localFile, "utf8");
  const html = extractPrimary10kHtml(raw);
  const scrubbed = scrubHtmlToText(html);
  const contentHash = hashText(scrubbed);

  const existing = await FilingModel.findOne({ accession: input.accession });
  if (existing && !input.force && existing.contentHash === contentHash) {
    return {
      filingId: String(existing._id),
      skipped: true,
      reason: "already_ingested",
    };
  }

  const scrubbedFile = /\.txt$/i.test(input.localFile)
    ? input.localFile.replace(/\.txt$/i, ".scrubbed.txt")
    : `${input.localFile}.scrubbed.txt`;
  await fs.writeFile(scrubbedFile, scrubbed, "utf8");

  const primaryHtmlFile = primaryHtmlPathFromLocalFile(input.localFile);
  await fs.writeFile(primaryHtmlFile, html, "utf8");

  const sections = detectItemSections(scrubbed);
  const chunks = recursiveChunk(
    scrubbed,
    config.chunkSize,
    config.chunkOverlap
  );

  const sectionLabels: Record<string, string> = {};
  for (const s of sections) {
    sectionLabels[s.item] = s.label;
  }

  const chunkMarkers = chunks.map((ch) => {
    const sec = sectionAtOffset(sections, ch.charStart);
    return {
      chunkId: uuidv4(),
      charStart: ch.charStart,
      charEnd: ch.charEnd,
      section: sec.label,
    };
  });

  const texts = chunks.map((c) => c.text);
  const vectors = await embedPassages(texts);

  const filing = await FilingModel.findOneAndUpdate(
    { accession: input.accession },
    {
      $set: {
        ticker: input.ticker.toUpperCase(),
        cik: String(input.cikNumeric),
        companyName: input.companyName,
        reportDate: input.reportDate,
        filingDate: input.filingDate,
        accession: input.accession,
        localFile: input.localFile,
        scrubbedFile,
        primaryHtmlFile,
        contentHash,
        sectionLabels,
        chunkMarkers,
      },
      $unset: { scrubbedText: "" },
    },
    { upsert: true, new: true }
  );

  if (!filing) {
    throw new Error("Failed to upsert filing");
  }

  const filingId = String(filing._id);
  await deletePointsByFilingId(filingId);

  const year = fiscalYearFromReportDate(input.reportDate);
  const points = chunks.map((ch, i) => {
    const sec = sectionAtOffset(sections, ch.charStart);
    const chunkId = chunkMarkers[i].chunkId;
    return {
      id: chunkId,
      vector: vectors[i],
      payload: {
        chunkId,
        filingId,
        ticker: input.ticker.toUpperCase(),
        year,
        section: sec.label,
        charStart: ch.charStart,
        charEnd: ch.charEnd,
        accession: input.accession,
        reportDate: input.reportDate,
        excerpt: ch.text.slice(0, 500),
      },
    };
  });

  await upsertChunks(points);
  return { filingId, skipped: false };
}
