import type { InvokeModelCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { describe, expect, it, vi } from "vitest";

import type { BedrockEmbeddingConfig } from "../src/adapters/embedding/bedrock-embedding-config.js";
import {
  BedrockEmbeddingProvider,
  BedrockEmbeddingResponseError,
  type InvokeBedrockEmbeddingModel,
} from "../src/adapters/embedding/bedrock-embedding-provider.js";

const config: BedrockEmbeddingConfig = {
  batchSize: 2,
  model: "amazon.test-embed",
  region: "us-east-1",
  timeoutMilliseconds: 30_000,
};

function vector(value: number): number[] {
  return Array.from({ length: 1_024 }, () => value);
}

function response(body: unknown): InvokeModelCommandOutput {
  return {
    $metadata: {},
    body: new TextEncoder().encode(JSON.stringify(body)) as never,
    contentType: "application/json",
  };
}

describe("BedrockEmbeddingProvider", () => {
  it("invokes Titan text embeddings with normalized 1024-dimensional output", async () => {
    const invokeModel = vi.fn<InvokeBedrockEmbeddingModel>(async () =>
      response({ embedding: vector(0.5) }),
    );
    const provider = new BedrockEmbeddingProvider(config, { invokeModel });

    await expect(provider.embed("xin chào")).resolves.toEqual(vector(0.5));
    expect(provider.dimensions).toBe(1_024);
    expect(invokeModel).toHaveBeenCalledWith(
      {
        accept: "application/json",
        body: JSON.stringify({
          dimensions: 1_024,
          inputText: "xin chào",
          normalize: true,
        }),
        contentType: "application/json",
        modelId: "amazon.test-embed",
      },
      expect.any(AbortSignal),
    );
  });

  it("batches requests, keeps output order, and does not invoke an empty batch", async () => {
    const invokeModel = vi.fn<InvokeBedrockEmbeddingModel>(async (input) => {
      const payload = JSON.parse(input.body as string) as { inputText: string };
      return response({ embedding: vector(payload.inputText.length) });
    });
    const provider = new BedrockEmbeddingProvider(config, { invokeModel });

    await expect(provider.embedBatch([])).resolves.toEqual([]);
    await expect(provider.embedBatch(["a", "bb", "ccc"])).resolves.toEqual([
      vector(1),
      vector(2),
      vector(3),
    ]);
    expect(invokeModel).toHaveBeenCalledTimes(3);
  });

  it.each([
    response({ embedding: [1, 2] }),
    response({ embedding: vector(Number.NaN) }),
    response({}),
    { $metadata: {}, contentType: "application/json" } as InvokeModelCommandOutput,
  ])("rejects invalid model response %#", async (invalidResponse) => {
    const provider = new BedrockEmbeddingProvider(config, {
      invokeModel: async () => invalidResponse,
    });

    await expect(provider.embed("text")).rejects.toThrow(
      BedrockEmbeddingResponseError,
    );
  });

  it("rejects blank text before invoking Bedrock", async () => {
    const invokeModel = vi.fn<InvokeBedrockEmbeddingModel>();
    const provider = new BedrockEmbeddingProvider(config, { invokeModel });

    await expect(provider.embed(" ")).rejects.toThrow(RangeError);
    await expect(provider.embedBatch(["valid", ""])).rejects.toThrow(
      "embedding text must be non-empty",
    );
    expect(invokeModel).not.toHaveBeenCalled();
  });
});
