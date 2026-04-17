import type { ReactNode } from "react";

export type ChunkMarker = {
  chunkId: string;
  charStart: number;
  charEnd: number;
  section?: string;
};

export function renderTextWithChunks(
  text: string,
  markers: ChunkMarker[]
): ReactNode {
  const sorted = [...markers].sort((a, b) => a.charStart - b.charStart);
  const out: ReactNode[] = [];
  let pos = 0;
  let k = 0;
  for (const m of sorted) {
    const s = Math.max(0, Math.min(m.charStart, text.length));
    const e = Math.max(s, Math.min(m.charEnd, text.length));
    if (s > pos) {
      out.push(<span key={`t-${k++}`}>{text.slice(pos, s)}</span>);
    }
    out.push(
      <span id={`chunk-${m.chunkId}`} key={m.chunkId} className="chunk-wrap">
        {text.slice(s, e)}
      </span>
    );
    pos = e;
  }
  if (pos < text.length) {
    out.push(<span key={`t-${k++}`}>{text.slice(pos)}</span>);
  }
  return <>{out}</>;
}

export function scrollToChunk(chunkId: string): void {
  const el = document.getElementById(`chunk-${chunkId}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}
