import type { GenerateContentResponse } from "@google/genai";
import { describe, expect, it, vi } from "vitest";

import type { GeminiLLMConfig } from "../src/adapters/llm/gemini-llm-config.js";
import {
  GeminiEmptyResponseError,
  GeminiLLMProvider,
  GeminiStructuredOutputParseError,
  type GenerateGeminiContent,
} from "../src/adapters/llm/gemini-llm-provider.js";

const config: GeminiLLMConfig = {
  apiKey: "test-api-key",
  defaultMaxTokens: 4_096,
  model: "gemini-test-model",
  timeoutMilliseconds: 30_000,
};

function createResponse(
  text: string | undefined,
  usageMetadata: GenerateContentResponse["usageMetadata"] = {
    candidatesTokenCount: 5,
    promptTokenCount: 12,
  },
): GenerateContentResponse {
  return {
    get text() {
      return text;
    },
    usageMetadata,
  } as GenerateContentResponse;
}

describe("GeminiLLMProvider", () => {
  it("maps text generation to the Gemini GenerateContent API", async () => {
    const generate = vi.fn<GenerateGeminiContent>(async () =>
      createResponse("Gemini answer"),
    );
    const provider = new GeminiLLMProvider(config, {
      generateContent: generate,
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
      text: "Gemini answer",
      usage: {
        inputTokens: 12,
        outputTokens: 5,
      },
    });
    expect(generate).toHaveBeenCalledWith({
      config: {
        maxOutputTokens: 500,
        systemInstruction: "Be concise",
        temperature: 0.25,
      },
      contents: [
        { parts: [{ text: "Question" }], role: "user" },
        { parts: [{ text: "Earlier answer" }], role: "model" },
      ],
      model: "gemini-test-model",
    });
  });

  it("uses defaults and omits optional request fields", async () => {
    const generate = vi.fn<GenerateGeminiContent>(async () =>
      createResponse("answer"),
    );
    const provider = new GeminiLLMProvider(config, {
      generateContent: generate,
    });

    await provider.generateText({
      messages: [{ content: "Question", role: "user" }],
    });

    expect(generate).toHaveBeenCalledWith({
      config: {
        maxOutputTokens: 4_096,
      },
      contents: [{ parts: [{ text: "Question" }], role: "user" }],
      model: "gemini-test-model",
    });
  });

  it("prompts for and parses JSON output from a description", async () => {
    const generate = vi.fn<GenerateGeminiContent>(async () =>
      createResponse('{"answer":"ok"}'),
    );
    const provider = new GeminiLLMProvider(config, {
      generateContent: generate,
    });

    await expect(
      provider.generateStructuredJSON<{ answer: string }>({
        messages: [{ content: "Question", role: "user" }],
        schemaDescription: "object with an answer string",
        systemPrompt: "Use the source",
      }),
    ).resolves.toEqual({ answer: "ok" });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.not.objectContaining({
          responseJsonSchema: expect.anything(),
        }),
      }),
    );
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          systemInstruction: expect.stringContaining(
            "Required structure:\nobject with an answer string",
          ),
        }),
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
    const generate = vi.fn<GenerateGeminiContent>(async () =>
      createResponse('{"answer":"ok"}'),
    );
    const provider = new GeminiLLMProvider(config, {
      generateContent: generate,
    });

    await provider.generateStructuredJSON({
      messages: [{ content: "Question", role: "user" }],
      schemaDescription: JSON.stringify(schema),
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          responseJsonSchema: schema,
          responseMimeType: "application/json",
        }),
      }),
    );
  });

  it("rejects malformed or empty structured output", async () => {
    const invalidJson = new GeminiLLMProvider(config, {
      generateContent: async () => createResponse("not-json"),
    });

    await expect(
      invalidJson.generateStructuredJSON({
        messages: [{ content: "Question", role: "user" }],
        schemaDescription: "an object",
      }),
    ).rejects.toThrow(GeminiStructuredOutputParseError);
    await expect(
      invalidJson.generateStructuredJSON({
        messages: [{ content: "Question", role: "user" }],
        schemaDescription: " ",
      }),
    ).rejects.toThrow("schemaDescription must be non-empty");
  });

  it("rejects a response without text", async () => {
    const provider = new GeminiLLMProvider(config, {
      generateContent: async () => createResponse(undefined),
    });

    await expect(
      provider.generateText({
        messages: [{ content: "Question", role: "user" }],
      }),
    ).rejects.toThrow(GeminiEmptyResponseError);
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
    const generate = vi.fn<GenerateGeminiContent>();
    const provider = new GeminiLLMProvider(config, {
      generateContent: generate,
    });

    await expect(provider.generateText(input)).rejects.toThrow(RangeError);
    expect(generate).not.toHaveBeenCalled();
  });
});
