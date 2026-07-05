import Anthropic from "@anthropic-ai/sdk";
import type {
  Message,
  MessageCreateParamsNonStreaming,
  MessageParam,
} from "@anthropic-ai/sdk/resources/messages";

import type {
  GeneratedText,
  GenerateStructuredJsonInput,
  GenerateTextInput,
  ILLMProvider,
} from "../../ports/index.js";
import type { AnthropicLLMConfig } from "./anthropic-llm-config.js";

export type CreateAnthropicMessage = (
  input: MessageCreateParamsNonStreaming,
) => Promise<Message>;

export interface AnthropicLLMProviderDependencies {
  readonly createMessage?: CreateAnthropicMessage;
}

export class LLMEmptyResponseError extends Error {
  constructor() {
    super("LLM response did not contain a text block");
    this.name = "LLMEmptyResponseError";
  }
}

export class StructuredOutputParseError extends Error {
  constructor(options?: ErrorOptions) {
    super("LLM response was not valid JSON", options);
    this.name = "StructuredOutputParseError";
  }
}

export class AnthropicLLMProvider implements ILLMProvider {
  private readonly createMessage: CreateAnthropicMessage;

  constructor(
    private readonly config: AnthropicLLMConfig,
    dependencies: AnthropicLLMProviderDependencies = {},
  ) {
    if (dependencies.createMessage) {
      this.createMessage = dependencies.createMessage;
      return;
    }

    const client = new Anthropic({
      apiKey: config.apiKey,
      maxRetries: config.maxRetries,
      timeout: config.timeoutMilliseconds,
    });
    this.createMessage = (input) => client.messages.create(input);
  }

  async generateText(input: GenerateTextInput): Promise<GeneratedText> {
    validateInput(input);
    const response = await this.createMessage(this.toRequest(input));

    return {
      text: extractText(response),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
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
      ? await this.generateTextWithOutputConfig(generationInput, schema)
      : await this.generateText(generationInput);

    try {
      return JSON.parse(generated.text) as T;
    } catch (error) {
      throw new StructuredOutputParseError({ cause: error });
    }
  }

  private async generateTextWithOutputConfig(
    input: GenerateTextInput,
    schema: Record<string, unknown>,
  ): Promise<GeneratedText> {
    validateInput(input);
    const response = await this.createMessage({
      ...this.toRequest(input),
      output_config: {
        format: {
          schema,
          type: "json_schema",
        },
      },
    });

    return {
      text: extractText(response),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  private toRequest(
    input: GenerateTextInput,
  ): MessageCreateParamsNonStreaming {
    return {
      max_tokens: input.maxTokens ?? this.config.defaultMaxTokens,
      messages: input.messages.map<MessageParam>((message) => ({
        content: message.content,
        role: message.role,
      })),
      model: this.config.model,
      ...(input.systemPrompt === undefined
        ? {}
        : { system: input.systemPrompt }),
      ...(input.temperature === undefined
        ? {}
        : { temperature: input.temperature }),
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

function extractText(message: Message): string {
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (text.length === 0) {
    throw new LLMEmptyResponseError();
  }

  return text;
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
    // A plain-language description still benefits from JSON-only output.
  }

  return undefined;
}
