import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";

import type {
  GeneratedText,
  GenerateStructuredJsonInput,
  GenerateTextInput,
  ILLMProvider,
} from "../../ports/index.js";
import type { GeminiLLMConfig } from "./gemini-llm-config.js";

export type GenerateGeminiContent = (
  input: GenerateContentParameters,
) => Promise<GenerateContentResponse>;

export interface GeminiLLMProviderDependencies {
  readonly generateContent?: GenerateGeminiContent;
}

export class GeminiEmptyResponseError extends Error {
  constructor() {
    super("Gemini response did not contain text");
    this.name = "GeminiEmptyResponseError";
  }
}

export class GeminiStructuredOutputParseError extends Error {
  constructor(options?: ErrorOptions) {
    super("Gemini response was not valid JSON", options);
    this.name = "GeminiStructuredOutputParseError";
  }
}

export class GeminiLLMProvider implements ILLMProvider {
  private readonly generate: GenerateGeminiContent;

  constructor(
    private readonly config: GeminiLLMConfig,
    dependencies: GeminiLLMProviderDependencies = {},
  ) {
    if (dependencies.generateContent) {
      this.generate = dependencies.generateContent;
      return;
    }

    const client = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: {
        timeout: config.timeoutMilliseconds,
      },
    });
    this.generate = (input) => client.models.generateContent(input);
  }

  async generateText(input: GenerateTextInput): Promise<GeneratedText> {
    validateInput(input);
    const response = await this.generate(this.toRequest(input));

    return toGeneratedText(response);
  }

  async generateStructuredJSON<T>(
    input: GenerateStructuredJsonInput,
  ): Promise<T> {
    if (input.schemaDescription.trim().length === 0) {
      throw new RangeError("schemaDescription must be non-empty");
    }

    const systemPrompt = [
      input.systemPrompt,
      "Return only JSON matching the required structure. Do not include markdown fences or commentary.",
      `Required structure:\n${input.schemaDescription}`,
    ]
      .filter((part): part is string => Boolean(part))
      .join("\n\n");
    const generationInput = {
      ...input,
      systemPrompt,
    };
    const schema = resolveJsonSchema(input.schemaDescription);
    const generated = schema
      ? await this.generateTextWithJsonSchema(generationInput, schema)
      : await this.generateText(generationInput);

    try {
      return JSON.parse(generated.text) as T;
    } catch (error) {
      throw new GeminiStructuredOutputParseError({ cause: error });
    }
  }

  private async generateTextWithJsonSchema(
    input: GenerateTextInput,
    schema: Record<string, unknown>,
  ): Promise<GeneratedText> {
    validateInput(input);
    const request = this.toRequest(input);
    const response = await this.generate({
      ...request,
      config: {
        ...request.config,
        responseJsonSchema: schema,
        responseMimeType: "application/json",
      },
    });

    return toGeneratedText(response);
  }

  private toRequest(input: GenerateTextInput): GenerateContentParameters {
    return {
      config: {
        maxOutputTokens: input.maxTokens ?? this.config.defaultMaxTokens,
        ...(input.systemPrompt === undefined
          ? {}
          : { systemInstruction: input.systemPrompt }),
        ...(input.temperature === undefined
          ? {}
          : { temperature: input.temperature }),
      },
      contents: input.messages.map((message) => ({
        parts: [{ text: message.content }],
        role: message.role === "assistant" ? "model" : "user",
      })),
      model: this.config.model,
    };
  }
}

function validateInput(input: GenerateTextInput): void {
  if (input.messages.length === 0) {
    throw new RangeError("messages must contain at least one message");
  }

  for (const message of input.messages) {
    if (message.content.trim().length === 0) {
      throw new RangeError("message content must be non-empty");
    }
  }

  if (
    input.maxTokens !== undefined &&
    (!Number.isSafeInteger(input.maxTokens) || input.maxTokens < 1)
  ) {
    throw new RangeError("maxTokens must be a positive integer");
  }

  if (
    input.temperature !== undefined &&
    (!Number.isFinite(input.temperature) ||
      input.temperature < 0 ||
      input.temperature > 1)
  ) {
    throw new RangeError("temperature must be between 0 and 1");
  }
}

function toGeneratedText(response: GenerateContentResponse): GeneratedText {
  const text = response.text?.trim();

  if (!text) {
    throw new GeminiEmptyResponseError();
  }

  return {
    text,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

function resolveJsonSchema(
  schemaDescription: string,
): Record<string, unknown> | undefined {
  try {
    const schema: unknown = JSON.parse(schemaDescription);

    if (
      typeof schema === "object" &&
      schema !== null &&
      !Array.isArray(schema)
    ) {
      return schema as Record<string, unknown>;
    }
  } catch {
    // Plain-language descriptions still benefit from JSON-only prompting.
  }

  return undefined;
}
