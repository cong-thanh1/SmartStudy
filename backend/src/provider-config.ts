import { z } from "zod";

const providerEnvironmentSchema = z.object({
  AUTH_PROVIDER: z.enum(["jwt", "cognito"]).default("jwt"),
  EMAIL_PROVIDER: z.enum(["smtp", "ses"]).default("smtp"),
  EMBEDDING_PROVIDER: z
    .enum(["local", "voyage", "openai", "bedrock"])
    .default("local"),
  LLM_PROVIDER: z
    .enum(["anthropic", "gemini", "bedrock", "mock"])
    .default("anthropic"),
  QUEUE_PROVIDER: z.enum(["redis", "sqs"]).default("redis"),
  STORAGE_PROVIDER: z.literal("s3-compatible").default("s3-compatible"),
  VECTOR_STORE: z.enum(["pgvector", "bedrock-kb"]).default("pgvector"),
});

type ProviderEnvironment = z.infer<typeof providerEnvironmentSchema>;

export type AuthProviderName = ProviderEnvironment["AUTH_PROVIDER"];
export type EmailProviderName = ProviderEnvironment["EMAIL_PROVIDER"];
export type EmbeddingProviderName = ProviderEnvironment["EMBEDDING_PROVIDER"];
export type LLMProviderName = ProviderEnvironment["LLM_PROVIDER"];
export type QueueProviderName = ProviderEnvironment["QUEUE_PROVIDER"];
export type StorageProviderName = ProviderEnvironment["STORAGE_PROVIDER"];
export type VectorStoreName = ProviderEnvironment["VECTOR_STORE"];

export interface ProviderConfig {
  readonly authProvider: AuthProviderName;
  readonly emailProvider: EmailProviderName;
  readonly embeddingProvider: EmbeddingProviderName;
  readonly llmProvider: LLMProviderName;
  readonly queueProvider: QueueProviderName;
  readonly storageProvider: StorageProviderName;
  readonly vectorStore: VectorStoreName;
}

export function loadProviderConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ProviderConfig {
  const parsed = providerEnvironmentSchema.parse(environment);

  return {
    authProvider: parsed.AUTH_PROVIDER,
    emailProvider: parsed.EMAIL_PROVIDER,
    embeddingProvider: parsed.EMBEDDING_PROVIDER,
    llmProvider: parsed.LLM_PROVIDER,
    queueProvider: parsed.QUEUE_PROVIDER,
    storageProvider: parsed.STORAGE_PROVIDER,
    vectorStore: parsed.VECTOR_STORE,
  };
}
