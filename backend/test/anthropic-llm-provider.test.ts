import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { describe, expect, it, vi } from "vitest";

import {
  AnthropicLLMProvider,
  LLMEmptyResponseError,
  StructuredOutputParseError,
  type CreateAnthropicMessage,
} from "../src/adapters/llm/anthropic-llm-provider.js";
import type { AnthropicLLMConfig } from "../src/adapters/llm/anthropic-llm-config.js";

const config: AnthropicLLMConfig = {
  apiKey: "test-api-key",
  defaultMaxTokens: 4_096,
  maxRetries: 2,
  model: "claude-test-model",
  timeoutMilliseconds: 30_000,
};

function createMessage(
  text: string,
  overrides: Partial<Message> = {},
): Message {
  return {
    content: [
      { citations: null, text, type: "text" },
      { citations: null, text: " second", type: "text" },
    ],
    container: null,
    id: "message-1",
    model: "claude-test-model",
    role: "assistant",
    stop_details: null,
    stop_reason: "end_turn",
    stop_sequence: null,
    type: "message",
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      inference_geo: null,
      input_tokens: 12,
      output_tokens: 5,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: "standard",
    },
    ...overrides,
  };
}

describe("AnthropicLLMProvider", () => {
  it("maps text generation to the Anthropic Messages API", async () => {
    const create = vi.fn<CreateAnthropicMessage>(
      async () => createMessage("first"),
    );
    const provider = new AnthropicLLMProvider(config, {
      createMessage: create,
    });

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
      usage: {
        inputTokens: 12,
        outputTokens: 5,
      },
    });
    expect(create).toHaveBeenCalledWith({
      max_tokens: 500,
      messages: [
        { content: "Question", role: "user" },
        { content: "Earlier answer", role: "assistant" },
      ],
      model: "claude-test-model",
      system: "Be concise",
      temperature: 0.25,
    });
  });

  it("uses defaults and omits optional request fields", async () => {
    const create = vi.fn<CreateAnthropicMessage>(
      async () => createMessage("answer"),
    );
    const provider = new AnthropicLLMProvider(config, {
      createMessage: create,
    });

    await provider.generateText({
      messages: [{ content: "Question", role: "user" }],
    });

    expect(create).toHaveBeenCalledWith({
      max_tokens: 4_096,
      messages: [{ content: "Question", role: "user" }],
      model: "claude-test-model",
    });
  });

  it("prompts for and parses JSON output from a description", async () => {
    const create = vi.fn<CreateAnthropicMessage>(async () =>
      createMessage('{"answer":"ok"}', {
        content: [
          {
            citations: null,
            text: '{"answer":"ok"}',
            type: "text",
          },
        ],
      }),
    );
    const provider = new AnthropicLLMProvider(config, {
      createMessage: create,
    });

    await expect(
      provider.generateStructuredJSON<{ answer: string }>({
        messages: [{ content: "Question", role: "user" }],
        schemaDescription: "object with an answer string",
        systemPrompt: "Use the source",
      }),
    ).resolves.toEqual({ answer: "ok" });

    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        output_config: expect.anything(),
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining(
          "Required structure:\nobject with an answer string",
        ),
      }),
    );
  });

  it("forwards a JSON Schema description to structured output", async () => {
    const schema = {
      additionalProperties: false,
      properties: { answer: { type: "string" } },
      required: ["answer"],
      type: "object",
    };
    const create = vi.fn<CreateAnthropicMessage>(async () =>
      createMessage('{"answer":"ok"}', {
        content: [
          {
            citations: null,
            text: '{"answer":"ok"}',
            type: "text",
          },
        ],
      }),
    );
    const provider = new AnthropicLLMProvider(config, {
      createMessage: create,
    });

    await provider.generateStructuredJSON({
      messages: [{ content: "Question", role: "user" }],
      schemaDescription: JSON.stringify(schema),
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        output_config: {
          format: {
            schema,
            type: "json_schema",
          },
        },
      }),
    );
  });

  it("rejects malformed or empty structured output", async () => {
    const invalidJson = new AnthropicLLMProvider(config, {
      createMessage: async () =>
        createMessage("not-json", {
          content: [
            { citations: null, text: "not-json", type: "text" },
          ],
        }),
    });

    await expect(
      invalidJson.generateStructuredJSON({
        messages: [{ content: "Question", role: "user" }],
        schemaDescription: "an object",
      }),
    ).rejects.toThrow(StructuredOutputParseError);
    await expect(
      invalidJson.generateStructuredJSON({
        messages: [{ content: "Question", role: "user" }],
        schemaDescription: " ",
      }),
    ).rejects.toThrow("schemaDescription must be non-empty");
  });

  it("rejects a response without text blocks", async () => {
    const provider = new AnthropicLLMProvider(config, {
      createMessage: async () =>
        createMessage("", {
          content: [],
        }),
    });

    await expect(
      provider.generateText({
        messages: [{ content: "Question", role: "user" }],
      }),
    ).rejects.toThrow(LLMEmptyResponseError);
  });

  it.each([
    { messages: [] },
    { messages: [{ content: " ", role: "user" as const }] },
    {
      maxTokens: 0,
      messages: [{ content: "Question", role: "user" as const }],
    },
    {
      maxTokens: 1.5,
      messages: [{ content: "Question", role: "user" as const }],
    },
    {
      messages: [{ content: "Question", role: "user" as const }],
      temperature: -0.1,
    },
    {
      messages: [{ content: "Question", role: "user" as const }],
      temperature: 1.1,
    },
  ])("rejects invalid generation input %#", async (input) => {
    const create = vi.fn<CreateAnthropicMessage>();
    const provider = new AnthropicLLMProvider(config, {
      createMessage: create,
    });

    await expect(provider.generateText(input)).rejects.toThrow(RangeError);
    expect(create).not.toHaveBeenCalled();
  });
});
