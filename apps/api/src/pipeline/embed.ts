import { EmbeddingModel, FlagEmbedding } from "fastembed";
import { config } from "../config.js";

let embedderPromise: Promise<FlagEmbedding> | null = null;

type StandardEmbeddingModel = Exclude<EmbeddingModel, EmbeddingModel.CUSTOM>;

function resolveModel(): StandardEmbeddingModel {
  const key = config.fastembedModelKey;
  const map: Record<string, StandardEmbeddingModel> = {
    AllMiniLML6V2: EmbeddingModel.AllMiniLML6V2,
    BGEBaseEN: EmbeddingModel.BGEBaseEN,
    BGEBaseENV15: EmbeddingModel.BGEBaseENV15,
    BGESmallEN: EmbeddingModel.BGESmallEN,
    BGESmallENV15: EmbeddingModel.BGESmallENV15,
    BGESmallZH: EmbeddingModel.BGESmallZH,
    MLE5Large: EmbeddingModel.MLE5Large,
  };
  const m = map[key];
  if (!m) {
    throw new Error(`Unknown FASTEMBED_MODEL: ${key}`);
  }
  return m;
}

export async function getEmbedder(): Promise<FlagEmbedding> {
  if (!embedderPromise) {
    const cacheDir = process.env.FASTEMBED_CACHE_DIR?.trim();
    embedderPromise = FlagEmbedding.init({
      model: resolveModel(),
      ...(cacheDir ? { cacheDir } : {}),
    });
  }
  return embedderPromise;
}

export async function embeddingDimensions(): Promise<number> {
  const e = await getEmbedder();
  const model = resolveModel();
  const info = e.listSupportedModels().find((x) => x.model === (model as EmbeddingModel));
  if (!info) {
    throw new Error("Could not read embedding dimensions");
  }
  return info.dim;
}

/** FastEmbed returns Float32Array; JSON.stringify turns TypedArrays into `{0:x,1:y}` objects, which Qdrant rejects. */
function vecToArray(v: Iterable<number>): number[] {
  return Array.from(v);
}

export async function embedPassages(
  texts: string[],
  batchSize = 32
): Promise<number[][]> {
  const e = await getEmbedder();
  const out: number[][] = [];
  for await (const batch of e.passageEmbed(texts, batchSize)) {
    for (const vec of batch) {
      out.push(vecToArray(vec));
    }
  }
  return out;
}

export async function embedQuery(q: string): Promise<number[]> {
  const e = await getEmbedder();
  const v = await e.queryEmbed(q);
  return vecToArray(v);
}
