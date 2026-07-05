import { z } from "zod";

const anthropicLLMEnvironmentSchema = z.object({
  ANTHROPIC_API_KEY: z.string().trim().min(1),
  ANTHROPIC_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
  ANTHROPIC_MAX_TOKENS: z.coerce
    .number()
    .int()
    .min(1)
    .max(64_000)
    .default(4_096),
  ANTHROPIC_MODEL: z.string().trim().min(1).default("claude-sonnet-4-6"),
  ANTHROPIC_TIMEOUT_MILLISECONDS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(600_000)
    .default(120_000),
});

export interface AnthropicLLMConfig {
  readonly apiKey: string;
  readonly defaultMaxTokens: number;
  readonly maxRetries: number;
  readonly model: string;
  readonly timeoutMilliseconds: number;
}

export function loadAnthropicLLMConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AnthropicLLMConfig {
  const parsed = anthropicLLMEnvironmentSchema.parse(environment);

  return {
    apiKey: parsed.ANTHROPIC_API_KEY,
    defaultMaxTokens: parsed.ANTHROPIC_MAX_TOKENS,
    maxRetries: parsed.ANTHROPIC_MAX_RETRIES,
    model: parsed.ANTHROPIC_MODEL,
    timeoutMilliseconds: parsed.ANTHROPIC_TIMEOUT_MILLISECONDS,
  };
}
