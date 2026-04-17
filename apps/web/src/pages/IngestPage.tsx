import { useEffect, useState } from "react";
import { api } from "../api";
import { TickerSearchInput } from "../components/TickerSearchInput";

type Job = {
  id: string;
  status: string;
  stage: string;
  ticker: string;
  error?: string;
  bytesDownloaded?: number;
  skipped?: boolean;
  createdAt?: string;
};

export default function IngestPage() {
  const [ticker, setTicker] = useState("");
  const [year, setYear] = useState("");
  const [force, setForce] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [poll, setPoll] = useState(0);

  useEffect(() => {
    api<{ jobs: Job[] }>("/api/ingestion/jobs?limit=30")
      .then((r) => setJobs(r.jobs))
      .catch((e: Error) => setSubmitErr(e.message));
  }, [poll]);

  useEffect(() => {
    const id = window.setInterval(() => setPoll((p) => p + 1), 2000);
    return () => window.clearInterval(id);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitErr(null);
    try {
      await api<{ jobId: string }>("/api/ingestion/jobs", {
        method: "POST",
        body: JSON.stringify({
          ticker: ticker.trim(),
          reportYear: year ? parseInt(year, 10) : undefined,
          force,
        }),
      });
      setPoll((p) => p + 1);
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>Ingestion</h1>
      <p className="muted">
        Start typing a ticker to search the SEC list, or enter a numeric CIK.
        Optionally restrict to a fiscal report year. Jobs download the full SEC
        submission, extract the 10-K HTML, scrub, chunk, embed, and index
        MongoDB + Qdrant.
      </p>
      <form className="panel stack" onSubmit={(e) => void onSubmit(e)}>
        <label htmlFor="ticker">Ticker or CIK</label>
        <TickerSearchInput
          id="ticker"
          value={ticker}
          onChange={setTicker}
          placeholder="Type e.g. MSF… or CIK 789019"
          required
        />
        <label htmlFor="year">Report year (optional)</label>
        <input
          id="year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="e.g. 2024"
        />
        <label className="row">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          Force re-index (re-embed even if content unchanged)
        </label>
        {submitErr && <div className="error">{submitErr}</div>}
        <button type="submit">Start ingestion job</button>
      </form>

      <div className="panel">
        <h2>Recent jobs</h2>
        {jobs.length === 0 && (
          <p className="muted">No jobs yet — submit one above.</p>
        )}
        {jobs.map((j) => (
          <div key={j.id} className="job-block">
            <div className="job-row">
              <span>
                <strong>{j.ticker}</strong> · {j.status}{" "}
                <span className="muted">
                  ({j.stage}
                  {j.bytesDownloaded != null
                    ? ` · ${j.bytesDownloaded} B`
                    : ""}
                  )
                </span>
              </span>
              <span className="muted">{j.id.slice(0, 8)}…</span>
            </div>
            {j.status === "failed" && j.error && (
              <div className="job-error" title={j.error}>
                {j.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
