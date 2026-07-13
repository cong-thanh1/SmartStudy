import { z } from "zod";

const bedrockLLMEnvironmentSchema = z.object({
  BEDROCK_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
  BEDROCK_MAX_TOKENS: z.coerce
    .number()
    .int()
    .min(1)
    .max(64_000)
    .default(4_096),
  BEDROCK_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("anthropic.claude-3-5-haiku-20241022-v1:0"),
  BEDROCK_REGION: z.string().trim().min(1).default("us-east-1"),
  BEDROCK_TIMEOUT_MILLISECONDS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(600_000)
    .default(120_000),
});

export interface BedrockLLMConfig {
  readonly defaultMaxTokens: number;
  readonly maxRetries: number;
  readonly model: string;
  readonly region: string;
  readonly timeoutMilliseconds: number;
}

export function loadBedrockLLMConfig(
  environment: NodeJS.ProcessEnv = process.env,
): BedrockLLMConfig {
  const parsed = bedrockLLMEnvironmentSchema.parse(environment);

  return {
    defaultMaxTokens: parsed.BEDROCK_MAX_TOKENS,
    maxRetries: parsed.BEDROCK_MAX_RETRIES,
    model: parsed.BEDROCK_MODEL,
    region: parsed.BEDROCK_REGION,
    timeoutMilliseconds: parsed.BEDROCK_TIMEOUT_MILLISECONDS,
  };
}
