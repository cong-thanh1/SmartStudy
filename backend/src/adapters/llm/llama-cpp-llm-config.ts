import { z } from "zod";

const llamaCppConfigSchema = z.object({
  LLAMA_CPP_BASE_URL: z.string().url().default("http://llama-cpp:8080"),
  LLAMA_CPP_MAX_TOKENS: z.coerce.number().int().positive().max(8_192).default(1_024),
  LLAMA_CPP_TIMEOUT_MILLISECONDS: z.coerce.number().int().positive().default(120_000),
});

export type LlamaCppLLMConfig = {
  readonly baseUrl: string;
  readonly maxTokens: number;
  readonly timeoutMilliseconds: number;
};

export function loadLlamaCppLLMConfig(
  environment: NodeJS.ProcessEnv = process.env,
): LlamaCppLLMConfig {
  const parsed = llamaCppConfigSchema.parse(environment);

  return {
    baseUrl: parsed.LLAMA_CPP_BASE_URL.replace(/\/$/, ""),
    maxTokens: parsed.LLAMA_CPP_MAX_TOKENS,
    timeoutMilliseconds: parsed.LLAMA_CPP_TIMEOUT_MILLISECONDS,
  };
}
