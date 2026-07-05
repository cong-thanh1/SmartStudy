import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  BGE_M3_DIMENSIONS,
  loadLocalBgeM3Config,
} from "../src/adapters/embedding/local-bge-m3-config.js";

describe("local BGE-M3 config", () => {
  it("uses the multilingual 1024-dimensional model defaults", () => {
    expect(BGE_M3_DIMENSIONS).toBe(1_024);
    expect(loadLocalBgeM3Config({})).toEqual({
      batchSize: 8,
      dtype: "q8",
      model: "onnx-community/bge-m3-ONNX",
    });
  });

  it("loads explicit model runtime settings", () => {
    expect(
      loadLocalBgeM3Config({
        EMBEDDING_BATCH_SIZE: "4",
        EMBEDDING_CACHE_DIR: " D:/models ",
        EMBEDDING_DTYPE: "fp32",
        EMBEDDING_MODEL: "local/bge-m3",
      }),
    ).toEqual({
      batchSize: 4,
      cacheDirectory: "D:/models",
      dtype: "fp32",
      model: "local/bge-m3",
    });
  });

  it("omits an empty cache directory", () => {
    expect(
      loadLocalBgeM3Config({ EMBEDDING_CACHE_DIR: " " }),
    ).not.toHaveProperty("cacheDirectory");
  });

  it.each([
    { EMBEDDING_BATCH_SIZE: "0" },
    { EMBEDDING_BATCH_SIZE: "65" },
    { EMBEDDING_DTYPE: "nope" },
    { EMBEDDING_MODEL: " " },
  ])("rejects invalid config %#", (environment) => {
    expect(() => loadLocalBgeM3Config(environment)).toThrow(ZodError);
  });
});
