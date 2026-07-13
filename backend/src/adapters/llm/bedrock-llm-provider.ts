import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";

import type {
  GeneratedText,
  GenerateStructuredJsonInput,
  GenerateTextInput,
  ILLMProvider,
} from "../../ports/index.js";
import type { BedrockLLMConfig } from "./bedrock-llm-config.js";

export type ConverseBedrockModel = (
  input: ConverseCommandInput,
  abortSignal: AbortSignal,
) => Promise<ConverseCommandOutput>;

export interface BedrockLLMProviderDependencies {
  readonly converse?: ConverseBedrockModel;
}

export class BedrockEmptyResponseError extends Error {
  constructor() {
    super("Bedrock response did not contain text");
    this.name = "BedrockEmptyResponseError";
  }
}

export class BedrockStructuredOutputParseError extends Error {
  constructor(options?: ErrorOptions) {
    super("Bedrock response was not valid JSON", options);
    this.name = "BedrockStructuredOutputParseError";
  }
}

export class BedrockLLMProvider implements ILLMProvider {
  private readonly converse: ConverseBedrockModel;

  constructor(
    private readonly config: BedrockLLMConfig,
    dependencies: BedrockLLMProviderDependencies = {},
  ) {
    if (dependencies.converse) {
      this.converse = dependencies.converse;
      return;
    }

    const client = new BedrockRuntimeClient({
      maxAttempts: config.maxRetries + 1,
      region: config.region,
    });
    this.converse = (input, abortSignal) =>
      client.send(new ConverseCommand(input), { abortSignal });
  }

  async generateText(input: GenerateTextInput): Promise<GeneratedText> {
    validateInput(input);
    const response = await this.converse(
      this.toRequest(input),
      AbortSignal.timeout(this.config.timeoutMilliseconds),
    );

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
    const generated = await this.generateText({
      ...input,
      systemPrompt,
    });

    try {
      return JSON.parse(generated.text) as T;
    } catch (error) {
      throw new BedrockStructuredOutputParseError({ cause: error });
    }
  }

  private toRequest(input: GenerateTextInput): ConverseCommandInput {
    return {
      inferenceConfig: {
        maxTokens: input.maxTokens ?? this.config.defaultMaxTokens,
        ...(input.temperature === undefined
          ? {}
          : { temperature: input.temperature }),
      },
      messages: input.messages.map((message) => ({
        content: [{ text: message.content }],
        role: message.role,
      })),
      modelId: this.config.model,
      ...(input.systemPrompt === undefined
        ? {}
        : { system: [{ text: input.systemPrompt }] }),
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

function toGeneratedText(response: ConverseCommandOutput): GeneratedText {
  const text = response.output?.message?.content
    ?.flatMap((block) => (block.text === undefined ? [] : [block.text]))
    .join("")
    .trim();

  if (!text) {
    throw new BedrockEmptyResponseError();
  }

  return {
    text,
    usage: {
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
    },
  };
}
