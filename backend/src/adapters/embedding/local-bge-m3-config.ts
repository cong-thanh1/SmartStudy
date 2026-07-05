import { z } from "zod";

export const BGE_M3_DIMENSIONS = 1_024;

const optionalNonEmptyString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const localBgeM3EnvironmentSchema = z.object({
  EMBEDDING_BATCH_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(64)
    .default(8),
  EMBEDDING_CACHE_DIR: optionalNonEmptyString,
  EMBEDDING_DTYPE: z
    .enum(["fp32", "fp16", "q8", "int8", "uint8", "q4"])
    .default("q8"),
  EMBEDDING_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("onnx-community/bge-m3-ONNX"),
});

type EmbeddingDtype = z.infer<
  typeof localBgeM3EnvironmentSchema
>["EMBEDDING_DTYPE"];

export interface LocalBgeM3Config {
  readonly batchSize: number;
  readonly cacheDirectory?: string;
  readonly dtype: EmbeddingDtype;
  readonly model: string;
}

export function loadLocalBgeM3Config(
  environment: NodeJS.ProcessEnv = process.env,
): LocalBgeM3Config {
  const parsed = localBgeM3EnvironmentSchema.parse(environment);

  return {
    batchSize: parsed.EMBEDDING_BATCH_SIZE,
    dtype: parsed.EMBEDDING_DTYPE,
    model: parsed.EMBEDDING_MODEL,
    ...(parsed.EMBEDDING_CACHE_DIR
      ? { cacheDirectory: parsed.EMBEDDING_CACHE_DIR }
      : {}),
  };
}
