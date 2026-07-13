import { z } from "zod";

const llamaCppConfigSchema = z.object({
  LLAMA_CPP_API_KEY_PARAMETER: z.string().trim().min(1).optional(),
  LLAMA_CPP_BASE_URL: z.string().url().default("http://llama-cpp:8080"),
  LLAMA_CPP_MAX_TOKENS: z.coerce.number().int().positive().max(8_192).default(1_024),
  LLAMA_CPP_TIMEOUT_MILLISECONDS: z.coerce.number().int().positive().default(120_000),
});

export type LlamaCppLLMConfig = {
  readonly apiKeyParameter?: string;
  readonly baseUrl: string;
  readonly maxTokens: number;
  readonly timeoutMilliseconds: number;
};

export function loadLlamaCppLLMConfig(
  environment: NodeJS.ProcessEnv = process.env,
): LlamaCppLLMConfig {
  const parsed = llamaCppConfigSchema.parse(environment);

  return {
    ...(parsed.LLAMA_CPP_API_KEY_PARAMETER === undefined
      ? {}
      : { apiKeyParameter: parsed.LLAMA_CPP_API_KEY_PARAMETER }),
    baseUrl: parsed.LLAMA_CPP_BASE_URL.replace(/\/$/, ""),
    maxTokens: parsed.LLAMA_CPP_MAX_TOKENS,
    timeoutMilliseconds: parsed.LLAMA_CPP_TIMEOUT_MILLISECONDS,
  };
}
