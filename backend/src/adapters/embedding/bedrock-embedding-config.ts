import { z } from "zod";

export const BEDROCK_EMBEDDING_DIMENSIONS = 1_024;

const bedrockEmbeddingEnvironmentSchema = z.object({
  BEDROCK_EMBEDDING_BATCH_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(64)
    .default(8),
  BEDROCK_EMBEDDING_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("amazon.titan-embed-text-v2:0"),
  BEDROCK_EMBEDDING_TIMEOUT_MILLISECONDS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(600_000)
    .default(120_000),
  BEDROCK_REGION: z.string().trim().min(1).default("us-east-1"),
});

export interface BedrockEmbeddingConfig {
  readonly batchSize: number;
  readonly model: string;
  readonly region: string;
  readonly timeoutMilliseconds: number;
}

export function loadBedrockEmbeddingConfig(
  environment: NodeJS.ProcessEnv = process.env,
): BedrockEmbeddingConfig {
  const parsed = bedrockEmbeddingEnvironmentSchema.parse(environment);

  return {
    batchSize: parsed.BEDROCK_EMBEDDING_BATCH_SIZE,
    model: parsed.BEDROCK_EMBEDDING_MODEL,
    region: parsed.BEDROCK_REGION,
    timeoutMilliseconds: parsed.BEDROCK_EMBEDDING_TIMEOUT_MILLISECONDS,
  };
}
