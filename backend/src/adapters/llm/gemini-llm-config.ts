import { z } from "zod";

const geminiLLMEnvironmentSchema = z.object({
  GEMINI_API_KEY: z.string().trim().min(1),
  GEMINI_MAX_TOKENS: z.coerce
    .number()
    .int()
    .min(1)
    .max(64_000)
    .default(4_096),
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-2.5-flash"),
  GEMINI_TIMEOUT_MILLISECONDS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(600_000)
    .default(120_000),
});

export interface GeminiLLMConfig {
  readonly apiKey: string;
  readonly defaultMaxTokens: number;
  readonly model: string;
  readonly timeoutMilliseconds: number;
}

export function loadGeminiLLMConfig(
  environment: NodeJS.ProcessEnv = process.env,
): GeminiLLMConfig {
  const parsed = geminiLLMEnvironmentSchema.parse(environment);

  return {
    apiKey: parsed.GEMINI_API_KEY,
    defaultMaxTokens: parsed.GEMINI_MAX_TOKENS,
    model: parsed.GEMINI_MODEL,
    timeoutMilliseconds: parsed.GEMINI_TIMEOUT_MILLISECONDS,
  };
}
