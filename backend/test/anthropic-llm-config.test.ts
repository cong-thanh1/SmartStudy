import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { loadAnthropicLLMConfig } from "../src/adapters/llm/anthropic-llm-config.js";

describe("Anthropic LLM config", () => {
  it("loads secure defaults", () => {
    expect(
      loadAnthropicLLMConfig({ ANTHROPIC_API_KEY: "test-api-key" }),
    ).toEqual({
      apiKey: "test-api-key",
      defaultMaxTokens: 4_096,
      maxRetries: 2,
      model: "claude-sonnet-4-6",
      timeoutMilliseconds: 120_000,
    });
  });

  it("loads explicit settings", () => {
    expect(
      loadAnthropicLLMConfig({
        ANTHROPIC_API_KEY: "test-api-key",
        ANTHROPIC_MAX_RETRIES: "4",
        ANTHROPIC_MAX_TOKENS: "2048",
        ANTHROPIC_MODEL: "claude-test-model",
        ANTHROPIC_TIMEOUT_MILLISECONDS: "30000",
      }),
    ).toEqual({
      apiKey: "test-api-key",
      defaultMaxTokens: 2_048,
      maxRetries: 4,
      model: "claude-test-model",
      timeoutMilliseconds: 30_000,
    });
  });

  it.each([
    {},
    { ANTHROPIC_API_KEY: " " },
    { ANTHROPIC_API_KEY: "key", ANTHROPIC_MAX_RETRIES: "-1" },
    { ANTHROPIC_API_KEY: "key", ANTHROPIC_MAX_TOKENS: "0" },
    {
      ANTHROPIC_API_KEY: "key",
      ANTHROPIC_TIMEOUT_MILLISECONDS: "500",
    },
  ])("rejects invalid config %#", (environment) => {
    expect(() => loadAnthropicLLMConfig(environment)).toThrow(ZodError);
  });
});
