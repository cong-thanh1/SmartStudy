import { pipeline } from "@huggingface/transformers";

import type { IEmbeddingProvider } from "../../ports/index.js";
import {
  BGE_M3_DIMENSIONS,
  type LocalBgeM3Config,
} from "./local-bge-m3-config.js";

export interface EmbeddingTensorLike {
  tolist(): unknown[];
}

export type EmbeddingModel = (
  texts: readonly string[],
) => Promise<EmbeddingTensorLike>;

export type CreateEmbeddingModel = (
  config: LocalBgeM3Config,
) => Promise<EmbeddingModel>;

export interface LocalBgeM3ProviderDependencies {
  readonly createModel?: CreateEmbeddingModel;
}

export class InvalidEmbeddingOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEmbeddingOutputError";
  }
}

export class LocalBgeM3Provider implements IEmbeddingProvider {
  readonly dimensions = BGE_M3_DIMENSIONS;

  private readonly createModel: CreateEmbeddingModel;
  private modelPromise: Promise<EmbeddingModel> | undefined;

  constructor(
    private readonly config: LocalBgeM3Config,
    dependencies: LocalBgeM3ProviderDependencies = {},
  ) {
    this.createModel = dependencies.createModel ?? createTransformersModel;
  }

  async embed(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0] as number[];
  }

  async embedBatch(texts: readonly string[]): Promise<number[][]> {
    validateTexts(texts);

    if (texts.length === 0) {
      return [];
    }

    const model = await this.getModel();
    const embeddings: number[][] = [];

    for (
      let start = 0;
      start < texts.length;
      start += this.config.batchSize
    ) {
      const batch = texts.slice(start, start + this.config.batchSize);
      const output = await model(batch);
      embeddings.push(...parseEmbeddings(output, batch.length));
    }

    return embeddings;
  }

  private getModel(): Promise<EmbeddingModel> {
    if (!this.modelPromise) {
      const loading = this.createModel(this.config);
      this.modelPromise = loading;
      void loading.catch(() => {
        if (this.modelPromise === loading) {
          this.modelPromise = undefined;
        }
      });
    }

    return this.modelPromise;
  }
}

async function createTransformersModel(
  config: LocalBgeM3Config,
): Promise<EmbeddingModel> {
  const extractor = await pipeline(
    "feature-extraction",
    config.model,
    {
      device: "cpu",
      dtype: config.dtype,
      ...(config.cacheDirectory
        ? { cache_dir: config.cacheDirectory }
        : {}),
    },
  );

  return async (texts) =>
    extractor([...texts], {
      normalize: true,
      pooling: "cls",
    });
}

function validateTexts(texts: readonly string[]): void {
  for (const text of texts) {
    if (text.trim().length === 0) {
      throw new RangeError("embedding text must be non-empty");
    }
  }
}

function parseEmbeddings(
  output: EmbeddingTensorLike,
  expectedCount: number,
): number[][] {
  const rows = output.tolist();

  if (rows.length !== expectedCount) {
    throw new InvalidEmbeddingOutputError(
      `Embedding model returned ${rows.length} vectors; expected ${expectedCount}`,
    );
  }

  return rows.map((row, index) => {
    if (!Array.isArray(row) || row.length !== BGE_M3_DIMENSIONS) {
      throw new InvalidEmbeddingOutputError(
        `Embedding vector ${index} must contain ${BGE_M3_DIMENSIONS} numbers`,
      );
    }

    if (
      !row.every(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      )
    ) {
      throw new InvalidEmbeddingOutputError(
        `Embedding vector ${index} contains a non-finite value`,
      );
    }

    return row;
  });
}
