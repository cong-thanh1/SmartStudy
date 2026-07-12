import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { describe, expect, it, vi } from "vitest";

import type { BedrockLLMConfig } from "../src/adapters/llm/bedrock-llm-config.js";
import {
  BedrockEmptyResponseError,
  BedrockLLMProvider,
  BedrockStructuredOutputParseError,
  type ConverseBedrockModel,
} from "../src/adapters/llm/bedrock-llm-provider.js";

const config: BedrockLLMConfig = {
  defaultMaxTokens: 4_096,
  maxRetries: 2,
  model: "anthropic.test-model",
  region: "us-east-1",
  timeoutMilliseconds: 30_000,
};

function createResponse(
  text: string,
  overrides: Partial<ConverseCommandOutput> = {},
): ConverseCommandOutput {
  return {
    $metadata: {},
    metrics: undefined,
    output: {
      message: {
        content: [{ text }, { text: " second" }],
        role: "assistant",
      },
    },
    stopReason: "end_turn",
    usage: {
      inputTokens: 12,
      outputTokens: 5,
      totalTokens: 17,
    },
    ...overrides,
  };
}

describe("BedrockLLMProvider", () => {
  it("maps text generation to the Bedrock Converse API", async () => {
    const converse = vi.fn<ConverseBedrockModel>(async () =>
      createResponse("first"),
    );
    const provider = new BedrockLLMProvider(config, { converse });

    await expect(
      provider.generateText({
        maxTokens: 500,
        messages: [
          { content: "Question", role: "user" },
          { content: "Earlier answer", role: "assistant" },
        ],
        systemPrompt: "Be concise",
        temperature: 0.25,
      }),
    ).resolves.toEqual({
      text: "first second",
      usage: { inputTokens: 12, outputTokens: 5 },
    });

    expect(converse).toHaveBeenCalledWith(
      {
        inferenceConfig: { maxTokens: 500, temperature: 0.25 },
        messages: [
          { content: [{ text: "Question" }], role: "user" },
          { content: [{ text: "Earlier answer" }], role: "assistant" },
        ],
        modelId: "anthropic.test-model",
        system: [{ text: "Be concise" }],
      },
      expect.any(AbortSignal),
    );
  });

  it("uses defaults and parses structured JSON", async () => {
    const converse = vi.fn<ConverseBedrockModel>(async () =>
      createResponse('{"answer":"ok"}', {
        output: {
          message: {
            content: [{ text: '{"answer":"ok"}' }],
            role: "assistant",
          },
        },
      }),
    );
    const provider = new BedrockLLMProvider(config, { converse });

    await expect(
      provider.generateStructuredJSON<{ answer: string }>({
        messages: [{ content: "Question", role: "user" }],
        schemaDescription: "object with an answer string",
      }),
    ).resolves.toEqual({ answer: "ok" });

    expect(converse).toHaveBeenCalledWith(
      expect.objectContaining({
        inferenceConfig: { maxTokens: 4_096 },
        system: [
          expect.objectContaining({
            text: expect.stringContaining(
              "Required structure:\nobject with an answer string",
            ),
          }),
        ],
      }),
      expect.any(AbortSignal),
    );
  });

  it("rejects malformed or empty responses", async () => {
    const invalidJson = new BedrockLLMProvider(config, {
      converse: async () => createResponse("not-json"),
    });
    const emptyResponse = new BedrockLLMProvider(config, {
      converse: async () => createResponse("", {
        output: { message: { content: [], role: "assistant" } },
      }),
    });

    await expect(
      invalidJson.generateStructuredJSON({
        messages: [{ content: "Question", role: "user" }],
        schemaDescription: "an object",
      }),
    ).rejects.toThrow(BedrockStructuredOutputParseError);
    await expect(
      emptyResponse.generateText({
        messages: [{ content: "Question", role: "user" }],
      }),
    ).rejects.toThrow(BedrockEmptyResponseError);
  });

  it.each([
    { messages: [] },
    { messages: [{ content: " ", role: "user" as const }] },
    { maxTokens: 0, messages: [{ content: "Question", role: "user" as const }] },
    { messages: [{ content: "Question", role: "user" as const }], temperature: -0.1 },
    { messages: [{ content: "Question", role: "user" as const }], temperature: 1.1 },
  ])("rejects invalid generation input %#", async (input) => {
    const converse = vi.fn<ConverseBedrockModel>();
    const provider = new BedrockLLMProvider(config, { converse });

    await expect(provider.generateText(input)).rejects.toThrow(RangeError);
    expect(converse).not.toHaveBeenCalled();
  });
});
