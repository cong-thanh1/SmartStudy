import { pipeline } from "@huggingface/transformers";
import { describe, expect, it, vi } from "vitest";

vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn(),
}));

import type { LocalBgeM3Config } from "../src/adapters/embedding/local-bge-m3-config.js";
import {
  InvalidEmbeddingOutputError,
  LocalBgeM3Provider,
  type CreateEmbeddingModel,
  type EmbeddingModel,
} from "../src/adapters/embedding/local-bge-m3-provider.js";

const config: LocalBgeM3Config = {
  batchSize: 2,
  dtype: "q8",
  model: "test/bge-m3",
};

function vector(value: number): number[] {
  return Array.from({ length: 1_024 }, () => value);
}

function output(rows: unknown[]) {
  return {
    tolist: () => rows,
  };
}

describe("LocalBgeM3Provider", () => {
  it("configures Transformers.js for normalized BGE-M3 CLS embeddings", async () => {
    const extractor = vi.fn(async () => output([vector(0.5)]));
    vi.mocked(pipeline).mockResolvedValueOnce(extractor as never);
    const runtimeConfig: LocalBgeM3Config = {
      ...config,
      cacheDirectory: "D:/model-cache",
    };
    const provider = new LocalBgeM3Provider(runtimeConfig);

    await expect(provider.embed("xin chào")).resolves.toEqual(vector(0.5));
    expect(pipeline).toHaveBeenCalledWith(
      "feature-extraction",
      "test/bge-m3",
      {
        cache_dir: "D:/model-cache",
        device: "cpu",
        dtype: "q8",
      },
    );
    expect(extractor).toHaveBeenCalledWith(["xin chào"], {
      normalize: true,
      pooling: "cls",
    });
  });

  it("loads lazily once, batches input, and preserves vector order", async () => {
    const model = vi.fn<EmbeddingModel>(async (texts) =>
      output(texts.map((text) => vector(text.length))),
    );
    const createModel = vi.fn<CreateEmbeddingModel>(async () => model);
    const provider = new LocalBgeM3Provider(config, { createModel });

    expect(provider.dimensions).toBe(1_024);
    expect(createModel).not.toHaveBeenCalled();
    await expect(
      provider.embedBatch(["a", "bb", "ccc"]),
    ).resolves.toEqual([vector(1), vector(2), vector(3)]);
    await expect(provider.embed("dddd")).resolves.toEqual(vector(4));

    expect(createModel).toHaveBeenCalledOnce();
    expect(createModel).toHaveBeenCalledWith(config);
    expect(model).toHaveBeenNthCalledWith(1, ["a", "bb"]);
    expect(model).toHaveBeenNthCalledWith(2, ["ccc"]);
    expect(model).toHaveBeenNthCalledWith(3, ["dddd"]);
  });

  it("returns an empty batch without loading the model", async () => {
    const createModel = vi.fn<CreateEmbeddingModel>();
    const provider = new LocalBgeM3Provider(config, { createModel });

    await expect(provider.embedBatch([])).resolves.toEqual([]);
    expect(createModel).not.toHaveBeenCalled();
  });

  it("allows model loading to retry after a transient failure", async () => {
    const model = vi.fn<EmbeddingModel>(async () => output([vector(1)]));
    const createModel = vi
      .fn<CreateEmbeddingModel>()
      .mockRejectedValueOnce(new Error("download failed"))
      .mockResolvedValueOnce(model);
    const provider = new LocalBgeM3Provider(config, { createModel });

    await expect(provider.embed("retry")).rejects.toThrow("download failed");
    await expect(provider.embed("retry")).resolves.toEqual(vector(1));
    expect(createModel).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      rows: [],
      expected: "returned 0 vectors",
    },
    {
      rows: [[1, 2]],
      expected: "must contain 1024 numbers",
    },
    {
      rows: [vector(Number.NaN)],
      expected: "contains a non-finite value",
    },
  ])("rejects invalid model output %#", async ({ rows, expected }) => {
    const provider = new LocalBgeM3Provider(config, {
      createModel: async () => async () => output(rows),
    });

    await expect(provider.embed("text")).rejects.toThrow(
      InvalidEmbeddingOutputError,
    );
    await expect(provider.embed("text")).rejects.toThrow(expected);
  });

  it("rejects blank text before loading the model", async () => {
    const createModel = vi.fn<CreateEmbeddingModel>();
    const provider = new LocalBgeM3Provider(config, { createModel });

    await expect(provider.embed(" ")).rejects.toThrow(RangeError);
    await expect(provider.embedBatch(["valid", ""])).rejects.toThrow(
      "embedding text must be non-empty",
    );
    expect(createModel).not.toHaveBeenCalled();
  });
});
