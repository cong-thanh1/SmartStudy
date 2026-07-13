import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  type InvokeModelCommandInput,
  type InvokeModelCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";

import type { IEmbeddingProvider } from "../../ports/index.js";
import {
  BEDROCK_EMBEDDING_DIMENSIONS,
  type BedrockEmbeddingConfig,
} from "./bedrock-embedding-config.js";

export type InvokeBedrockEmbeddingModel = (
  input: InvokeModelCommandInput,
  abortSignal: AbortSignal,
) => Promise<InvokeModelCommandOutput>;

export interface BedrockEmbeddingProviderDependencies {
  readonly invokeModel?: InvokeBedrockEmbeddingModel;
}

export class BedrockEmbeddingResponseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BedrockEmbeddingResponseError";
  }
}

export class BedrockEmbeddingProvider implements IEmbeddingProvider {
  readonly dimensions = BEDROCK_EMBEDDING_DIMENSIONS;

  private readonly invokeModel: InvokeBedrockEmbeddingModel;

  constructor(
    private readonly config: BedrockEmbeddingConfig,
    dependencies: BedrockEmbeddingProviderDependencies = {},
  ) {
    if (dependencies.invokeModel) {
      this.invokeModel = dependencies.invokeModel;
      return;
    }

    const client = new BedrockRuntimeClient({ region: config.region });
    this.invokeModel = (input, abortSignal) =>
      client.send(new InvokeModelCommand(input), { abortSignal });
  }

  async embed(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0] as number[];
  }

  async embedBatch(texts: readonly string[]): Promise<number[][]> {
    validateTexts(texts);

    const embeddings: number[][] = [];
    for (let start = 0; start < texts.length; start += this.config.batchSize) {
      const batch = texts.slice(start, start + this.config.batchSize);
      embeddings.push(
        ...(await Promise.all(batch.map((text) => this.embedText(text)))),
      );
    }

    return embeddings;
  }

  private async embedText(text: string): Promise<number[]> {
    const response = await this.invokeModel(
      {
        accept: "application/json",
        body: JSON.stringify({
          dimensions: this.dimensions,
          inputText: text,
          normalize: true,
        }),
        contentType: "application/json",
        modelId: this.config.model,
      },
      AbortSignal.timeout(this.config.timeoutMilliseconds),
    );
    return parseEmbedding(response);
  }
}

function validateTexts(texts: readonly string[]): void {
  for (const text of texts) {
    if (text.trim().length === 0) {
      throw new RangeError("embedding text must be non-empty");
    }
  }
}

function parseEmbedding(response: InvokeModelCommandOutput): number[] {
  if (!response.body) {
    throw new BedrockEmbeddingResponseError(
      "Bedrock embedding response did not contain a body",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(response.body));
  } catch (error) {
    throw new BedrockEmbeddingResponseError(
      "Bedrock embedding response was not valid JSON",
      { cause: error },
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("embedding" in parsed) ||
    !Array.isArray(parsed.embedding) ||
    parsed.embedding.length !== BEDROCK_EMBEDDING_DIMENSIONS ||
    !parsed.embedding.every(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    )
  ) {
    throw new BedrockEmbeddingResponseError(
      `Bedrock embedding response must contain ${BEDROCK_EMBEDDING_DIMENSIONS} finite numbers`,
    );
  }

  return parsed.embedding;
}
