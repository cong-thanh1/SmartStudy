import type {
  GeneratedText,
  GenerateStructuredJsonInput,
  GenerateTextInput,
  ILLMProvider,
  LLMMessage,
} from "../../ports/index.js";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import type { LlamaCppLLMConfig } from "./llama-cpp-llm-config.js";

interface CompletionResponse {
  readonly choices?: readonly { readonly message?: { readonly content?: string } }[];
  readonly usage?: { readonly completion_tokens?: number; readonly prompt_tokens?: number };
}

export class LlamaCppLLMProvider implements ILLMProvider {
  private apiKey: string | undefined;

  constructor(private readonly config: LlamaCppLLMConfig) {}

  async generateStructuredJSON<T>(input: GenerateStructuredJsonInput): Promise<T> {
    const result = await this.complete(input, true, input.schemaDescription);

    try {
      return JSON.parse(stripCodeFence(result.text)) as T;
    } catch (error) {
      throw new Error(
        `llama.cpp returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  generateText(input: GenerateTextInput): Promise<GeneratedText> {
    return this.complete(input, false);
  }

  private async complete(
    input: GenerateTextInput,
    structuredJson: boolean,
    schemaDescription?: string,
  ): Promise<GeneratedText> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMilliseconds,
    );

    try {
      const apiKey = await this.resolveApiKey();
      const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        body: JSON.stringify({
          max_tokens: input.maxTokens ?? this.config.maxTokens,
          messages: toMessages(input.messages, input.systemPrompt),
          model: this.config.model,
          // Ollama and current llama.cpp OpenAI-compatible endpoints enforce a
          // schema through the standard `json_schema` response format. Sending
          // a schema beside `json_object` only guarantees valid JSON and lets
          // smaller models rename or omit required fields.
          response_format: structuredJson
            ? {
                json_schema: {
                  name: "structured_response",
                  schema: resolveJsonSchema(schemaDescription),
                  strict: true,
                },
                type: "json_schema",
              }
            : undefined,
          stream: false,
          temperature: input.temperature ?? 0.3,
        }),
        headers: {
          "Content-Type": "application/json",
          ...(apiKey === undefined ? {} : { "x-api-key": apiKey }),
        },
        method: "POST",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as CompletionResponse | null;

      if (!response.ok) {
        throw new Error(`llama.cpp request failed with HTTP ${response.status}`);
      }

      const text = payload?.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new Error("llama.cpp returned an empty response");
      }

      return {
        text,
        ...(payload?.usage
          ? {
              usage: {
                inputTokens: payload.usage.prompt_tokens ?? 0,
                outputTokens: payload.usage.completion_tokens ?? 0,
              },
            }
          : {}),
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `llama.cpp request timed out after ${this.config.timeoutMilliseconds}ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveApiKey(): Promise<string | undefined> {
    if (!this.config.apiKeyParameter) return undefined;
    if (this.apiKey) return this.apiKey;
    const response = await new SSMClient({}).send(new GetParameterCommand({
      Name: this.config.apiKeyParameter,
      WithDecryption: true,
    }));
    const value = response.Parameter?.Value?.trim();
    if (!value) throw new Error(`Local AI key parameter ${this.config.apiKeyParameter} is empty`);
    this.apiKey = value;
    return value;
  }
}

function toMessages(
  messages: readonly LLMMessage[],
  systemPrompt?: string,
): readonly { readonly content: string; readonly role: "assistant" | "system" | "user" }[] {
  return [
    ...(systemPrompt ? [{ content: systemPrompt, role: "system" as const }] : []),
    ...messages,
  ];
}

function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function resolveJsonSchema(schemaDescription?: string): Record<string, unknown> {
  if (schemaDescription === undefined) {
    return { type: "object" };
  }

  try {
    const parsed: unknown = JSON.parse(schemaDescription);

    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Callers using a prose schema still get grammar-constrained JSON output.
  }

  return { type: "object" };
}
