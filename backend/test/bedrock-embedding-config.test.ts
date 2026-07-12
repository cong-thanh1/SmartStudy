import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { loadBedrockEmbeddingConfig } from "../src/adapters/embedding/bedrock-embedding-config.js";

describe("Bedrock embedding config", () => {
  it("loads defaults compatible with the existing pgvector dimensions", () => {
    expect(loadBedrockEmbeddingConfig({})).toEqual({
      batchSize: 8,
      model: "amazon.titan-embed-text-v2:0",
      region: "us-east-1",
      timeoutMilliseconds: 120_000,
    });
  });

  it("loads explicit settings", () => {
    expect(
      loadBedrockEmbeddingConfig({
        BEDROCK_EMBEDDING_BATCH_SIZE: "4",
        BEDROCK_EMBEDDING_MODEL: "amazon.test-embed",
        BEDROCK_EMBEDDING_TIMEOUT_MILLISECONDS: "30000",
        BEDROCK_REGION: "ap-southeast-1",
      }),
    ).toEqual({
      batchSize: 4,
      model: "amazon.test-embed",
      region: "ap-southeast-1",
      timeoutMilliseconds: 30_000,
    });
  });

  it.each([
    { BEDROCK_EMBEDDING_BATCH_SIZE: "0" },
    { BEDROCK_EMBEDDING_MODEL: " " },
    { BEDROCK_EMBEDDING_TIMEOUT_MILLISECONDS: "500" },
    { BEDROCK_REGION: " " },
  ])("rejects invalid config %#", (environment) => {
    expect(() => loadBedrockEmbeddingConfig(environment)).toThrow(ZodError);
  });
});
