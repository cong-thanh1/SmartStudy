import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { loadBedrockLLMConfig } from "../src/adapters/llm/bedrock-llm-config.js";

describe("Bedrock LLM config", () => {
  it("loads production-safe defaults", () => {
    expect(loadBedrockLLMConfig({})).toEqual({
      defaultMaxTokens: 4_096,
      maxRetries: 2,
      model: "anthropic.claude-3-5-haiku-20241022-v1:0",
      region: "us-east-1",
      timeoutMilliseconds: 120_000,
    });
  });

  it("loads explicit settings", () => {
    expect(
      loadBedrockLLMConfig({
        BEDROCK_MAX_RETRIES: "4",
        BEDROCK_MAX_TOKENS: "2048",
        BEDROCK_MODEL: "anthropic.test-model",
        BEDROCK_REGION: "ap-southeast-1",
        BEDROCK_TIMEOUT_MILLISECONDS: "30000",
      }),
    ).toEqual({
      defaultMaxTokens: 2_048,
      maxRetries: 4,
      model: "anthropic.test-model",
      region: "ap-southeast-1",
      timeoutMilliseconds: 30_000,
    });
  });

  it.each([
    { BEDROCK_MODEL: " " },
    { BEDROCK_MAX_RETRIES: "-1" },
    { BEDROCK_MAX_TOKENS: "0" },
    { BEDROCK_REGION: " " },
    { BEDROCK_TIMEOUT_MILLISECONDS: "500" },
  ])("rejects invalid config %#", (environment) => {
    expect(() => loadBedrockLLMConfig(environment)).toThrow(ZodError);
  });
});
