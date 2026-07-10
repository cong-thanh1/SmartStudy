import { afterEach, describe, expect, it, vi } from "vitest";

import type { LlamaCppLLMConfig } from "../src/adapters/llm/llama-cpp-llm-config.js";
import { LlamaCppLLMProvider } from "../src/adapters/llm/llama-cpp-llm-provider.js";

const config: LlamaCppLLMConfig = {
  baseUrl: "http://llama-cpp:8080",
  maxTokens: 1_024,
  timeoutMilliseconds: 1_000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LlamaCppLLMProvider", () => {
  it("sends an OpenAI-compatible request and maps text and usage", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "  Local answer  " } }],
          usage: { completion_tokens: 8, prompt_tokens: 12 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new LlamaCppLLMProvider(config);

    await expect(
      provider.generateText({
        messages: [{ content: "Question", role: "user" }],
        systemPrompt: "Be concise",
      }),
    ).resolves.toEqual({
      text: "Local answer",
      usage: { inputTokens: 12, outputTokens: 8 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://llama-cpp:8080/v1/chat/completions",
      expect.objectContaining({
        body: JSON.stringify({
          max_tokens: 1_024,
          messages: [
            { content: "Be concise", role: "system" },
            { content: "Question", role: "user" },
          ],
          stream: false,
          temperature: 0.3,
        }),
        method: "POST",
      }),
    );
  });

  it("uses the supplied JSON schema and parses fenced structured output", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "```json\n{\"answer\":\"ok\"}\n```" } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new LlamaCppLLMProvider(config);
    const schema = { properties: { answer: { type: "string" } }, type: "object" };

    await expect(
      provider.generateStructuredJSON<{ answer: string }>({
        messages: [{ content: "Question", role: "user" }],
        schemaDescription: JSON.stringify(schema),
      }),
    ).resolves.toEqual({ answer: "ok" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining(
          '"response_format":{"schema":{"properties":{"answer":{"type":"string"}},"type":"object"},"type":"json_object"}',
        ),
      }),
    );
  });

  it("uses a generic grammar for prose schemas and rejects malformed JSON", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "not-json" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new LlamaCppLLMProvider(config);

    await expect(
      provider.generateStructuredJSON({
        messages: [{ content: "Question", role: "user" }],
        schemaDescription: "an answer object",
      }),
    ).rejects.toThrow("llama.cpp returned invalid JSON");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"schema":{"type":"object"}'),
      }),
    );
  });

  it("reports HTTP, empty-response, and timeout failures", async () => {
    const provider = new LlamaCppLLMProvider(config);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );
    await expect(
      provider.generateText({ messages: [{ content: "Question", role: "user" }] }),
    ).rejects.toThrow("HTTP 503");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })),
    );
    await expect(
      provider.generateText({ messages: [{ content: "Question", role: "user" }] }),
    ).rejects.toThrow("empty response");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      }),
    );
    await expect(
      provider.generateText({ messages: [{ content: "Question", role: "user" }] }),
    ).rejects.toThrow("timed out after 1000ms");
  });
});
