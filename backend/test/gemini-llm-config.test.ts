import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { loadGeminiLLMConfig } from "../src/adapters/llm/gemini-llm-config.js";

describe("Gemini LLM config", () => {
  it("loads defaults from the environment", () => {
    expect(loadGeminiLLMConfig({ GEMINI_API_KEY: "test-api-key" })).toEqual({
      apiKey: "test-api-key",
      defaultMaxTokens: 4_096,
      model: "gemini-2.5-flash",
      timeoutMilliseconds: 120_000,
    });
  });

  it("loads overrides from the environment", () => {
    expect(
      loadGeminiLLMConfig({
        GEMINI_API_KEY: "test-api-key",
        GEMINI_MAX_TOKENS: "2048",
        GEMINI_MODEL: "gemini-test-model",
        GEMINI_TIMEOUT_MILLISECONDS: "30000",
      }),
    ).toEqual({
      apiKey: "test-api-key",
      defaultMaxTokens: 2_048,
      model: "gemini-test-model",
      timeoutMilliseconds: 30_000,
    });
  });

  it.each([
    {},
    { GEMINI_API_KEY: " " },
    { GEMINI_API_KEY: "key", GEMINI_MAX_TOKENS: "0" },
    {
      GEMINI_API_KEY: "key",
      GEMINI_TIMEOUT_MILLISECONDS: "500",
    },
  ])("rejects invalid config %#", (environment) => {
    expect(() => loadGeminiLLMConfig(environment)).toThrow(ZodError);
  });
});
