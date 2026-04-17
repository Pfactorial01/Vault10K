import mongoose from "mongoose";
import { IngestionJobModel } from "../models/ingestionJob.js";
import { ingestFilingFromLocalFile } from "../pipeline/ingest.js";
import { downloadFullSubmissionToFile } from "../sec/downloadSubmission.js";
import { fetchSubmissions, findTenK } from "../sec/submissions.js";
import type { SubmissionsJson } from "../sec/submissions.js";
import { padCik, resolveCikFromTicker } from "../sec/tickerToCik.js";

let queueBusy = false;

export async function enqueueProcessNext(): Promise<void> {
  if (queueBusy) return;
  queueBusy = true;
  try {
    while (true) {
      const job = await IngestionJobModel.findOneAndUpdate(
        { status: "queued" },
        { status: "downloading", stage: "downloading" },
        { sort: { createdAt: 1 }, new: true }
      );
      if (!job) break;
      try {
        await runOneJob(job._id.toString());
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        await IngestionJobModel.findByIdAndUpdate(job._id, {
          status: "failed",
          stage: "failed",
          error: err,
        });
      }
    }
  } finally {
    queueBusy = false;
  }
}

function displayTickerFromSubmissions(sub: SubmissionsJson, cikNum: number): string {
  const t = sub.tickers?.find((x) => x.length > 0);
  if (t) return t.toUpperCase();
  return `CIK${cikNum}`;
}

async function runOneJob(jobId: string): Promise<void> {
  const job = await IngestionJobModel.findById(jobId);
  if (!job) return;

  const trimmed = job.ticker.trim();
  let cikNum: number;

  if (/^\d{1,10}$/.test(trimmed)) {
    cikNum = parseInt(trimmed, 10);
  } else {
    const row = await resolveCikFromTicker(trimmed);
    cikNum = row.cik_str;
  }

  const sub = await fetchSubmissions(cikNum);
  const displayTicker = displayTickerFromSubmissions(sub, cikNum);

  await IngestionJobModel.findByIdAndUpdate(jobId, {
    cik: padCik(cikNum),
    ticker: displayTicker,
  });

  const match = findTenK(sub.filings.recent, job.reportYear);
  if (!match) {
    await IngestionJobModel.findByIdAndUpdate(jobId, {
      status: "failed",
      stage: "failed",
      error: "No Form 10-K found for the given criteria",
    });
    return;
  }

  const dl = await downloadFullSubmissionToFile({
    cikNumeric: cikNum,
    ticker: displayTicker,
    accession: match.accession,
    reportDate: match.reportDate,
    filingDate: match.filingDate,
  });

  await IngestionJobModel.findByIdAndUpdate(jobId, {
    bytesDownloaded: dl.bytes,
    localFile: dl.localPath,
    status: "processing",
    stage: "processing",
  });

  const result = await ingestFilingFromLocalFile({
    ticker: displayTicker,
    cikNumeric: cikNum,
    companyName: sub.name,
    reportDate: match.reportDate,
    filingDate: match.filingDate,
    accession: match.accession,
    localFile: dl.localPath,
    force: job.force === true,
  });

  if (result.skipped) {
    await IngestionJobModel.findByIdAndUpdate(jobId, {
      status: "completed",
      stage: "completed",
      skipped: true,
      skipReason: result.reason,
      filingId: new mongoose.Types.ObjectId(result.filingId),
    });
    return;
  }

  await IngestionJobModel.findByIdAndUpdate(jobId, {
    status: "completed",
    stage: "completed",
    filingId: new mongoose.Types.ObjectId(result.filingId),
    skipped: false,
  });
}

export function triggerQueue(): void {
  setImmediate(() => {
    enqueueProcessNext().catch((e) => {
      console.error("ingestion queue", e);
    });
  });
}
