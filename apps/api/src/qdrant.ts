import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "./config.js";
import { embeddingDimensions } from "./pipeline/embed.js";

let clientPromise: Promise<QdrantClient> | null = null;
let ensured = false;

export async function getQdrant(): Promise<QdrantClient> {
  if (!clientPromise) {
    clientPromise = Promise.resolve(
      new QdrantClient({ url: config.qdrantUrl })
    );
  }
  return clientPromise;
}

export async function ensureCollection(): Promise<void> {
  if (ensured) return;
  const client = await getQdrant();
  const dim = await embeddingDimensions();
  const cols = await client.getCollections();
  const exists = cols.collections.some(
    (c) => c.name === config.qdrantCollection
  );
  if (!exists) {
    await client.createCollection(config.qdrantCollection, {
      vectors: { size: dim, distance: "Cosine" },
    });
  }
  ensured = true;
}

export type ChunkPoint = {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
};

/** Large filings (e.g. MSFT) produce thousands of points; one huge JSON body returns HTTP 400 from Qdrant. */
const UPSERT_BATCH = 256;

export async function upsertChunks(points: ChunkPoint[]): Promise<void> {
  if (points.length === 0) return;
  await ensureCollection();
  const client = await getQdrant();
  const mapped = points.map((p) => ({
    id: p.id,
    vector: p.vector,
    payload: p.payload,
  }));
  for (let i = 0; i < mapped.length; i += UPSERT_BATCH) {
    const batch = mapped.slice(i, i + UPSERT_BATCH);
    await client.upsert(config.qdrantCollection, {
      wait: true,
      points: batch,
    });
  }
}

export async function deletePointsByFilingId(filingId: string): Promise<void> {
  await ensureCollection();
  const client = await getQdrant();
  await client.delete(config.qdrantCollection, {
    wait: true,
    filter: {
      must: [
        {
          key: "filingId",
          match: { value: filingId },
        },
      ],
    },
  });
}

export async function searchChunks(
  vector: number[],
  top: number,
  filter?: { ticker?: string; year?: number }
): Promise<
  {
    id: string;
    score: number;
    payload: Record<string, unknown>;
  }[]
> {
  await ensureCollection();
  const client = await getQdrant();
  const must: object[] = [];
  if (filter?.ticker) {
    must.push({
      key: "ticker",
      match: { value: filter.ticker.toUpperCase() },
    });
  }
  if (filter?.year !== undefined) {
    must.push({
      key: "year",
      match: { value: filter.year },
    });
  }
  const res = await client.search(config.qdrantCollection, {
    vector,
    limit: top,
    filter: must.length ? { must } : undefined,
    with_payload: true,
  });
  return res.map((r) => ({
    id: String(r.id),
    score: r.score ?? 0,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));
}
