import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  createAuthProviderFromEnv,
  createEmbeddingProviderFromEnv,
  createLazyLLMProviderFromEnv,
  createLLMProviderFromEnv,
  createQueueProviderFromEnv,
  createStorageProviderFromEnv,
  createVectorStoreFromEnv,
  ProviderFactory,
  ProviderNotRegisteredError,
  type ProviderRegistry,
  type Providers,
} from "../src/provider-factory.js";
import { JwtAuthProvider } from "../src/adapters/auth/jwt-auth-provider.js";
import { LocalBgeM3Provider } from "../src/adapters/embedding/local-bge-m3-provider.js";
import { AnthropicLLMProvider } from "../src/adapters/llm/anthropic-llm-provider.js";
import { RedisQueueProvider } from "../src/adapters/queue/redis-queue-provider.js";
import { S3CompatibleStorageProvider } from "../src/adapters/storage/s3-compatible-storage-provider.js";
import { PgVectorStore } from "../src/adapters/vector/pg-vector-store.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { IAuthRepository } from "../src/modules/auth/auth-repository.js";
import { loadProviderConfig } from "../src/provider-config.js";
import { ProviderConfigurationError } from "../src/provider-errors.js";
import type {
  IAuthProvider,
  IEmailProvider,
  IEmbeddingProvider,
  ILLMProvider,
  IQueueProvider,
  IStorageProvider,
  IVectorStore,
} from "../src/ports/index.js";

function createProviderStubs(): Providers {
  return {
    auth: Object.freeze({}) as IAuthProvider,
    email: Object.freeze({}) as IEmailProvider,
    embedding: Object.freeze({}) as IEmbeddingProvider,
    llm: Object.freeze({}) as ILLMProvider,
    queue: Object.freeze({}) as IQueueProvider,
    storage: Object.freeze({}) as IStorageProvider,
    vectorStore: Object.freeze({}) as IVectorStore,
  };
}

function createLocalRegistry(providers: Providers): ProviderRegistry {
  return {
    auth: { jwt: vi.fn(() => providers.auth) },
    email: { smtp: vi.fn(() => providers.email) },
    embedding: { local: vi.fn(() => providers.embedding) },
    llm: { anthropic: vi.fn(() => providers.llm) },
    queue: { redis: vi.fn(() => providers.queue) },
    storage: { "s3-compatible": vi.fn(() => providers.storage) },
    vectorStore: { pgvector: vi.fn(() => providers.vectorStore) },
  };
}

describe("provider config", () => {
  it("uses local-first defaults", () => {
    expect(loadProviderConfig({})).toEqual({
      authProvider: "jwt",
      emailProvider: "smtp",
      embeddingProvider: "local",
      llmProvider: "anthropic",
      queueProvider: "redis",
      storageProvider: "s3-compatible",
      vectorStore: "pgvector",
    });
  });

  it("accepts supported replacement providers", () => {
    expect(
      loadProviderConfig({
        AUTH_PROVIDER: "cognito",
        EMAIL_PROVIDER: "ses",
        EMBEDDING_PROVIDER: "bedrock",
        LLM_PROVIDER: "bedrock",
        QUEUE_PROVIDER: "sqs",
        STORAGE_PROVIDER: "s3-compatible",
        VECTOR_STORE: "bedrock-kb",
      }),
    ).toEqual({
      authProvider: "cognito",
      emailProvider: "ses",
      embeddingProvider: "bedrock",
      llmProvider: "bedrock",
      queueProvider: "sqs",
      storageProvider: "s3-compatible",
      vectorStore: "bedrock-kb",
    });
  });

  it("rejects an unsupported provider name", () => {
    expect(() => loadProviderConfig({ LLM_PROVIDER: "unknown" })).toThrow(
      ZodError,
    );
  });
});

describe("ProviderFactory", () => {
  it("builds every configured local provider", () => {
    const providers = createProviderStubs();
    const registry = createLocalRegistry(providers);

    const resolved = ProviderFactory.fromEnv(registry, {}).createProviders();

    expect(resolved).toEqual(providers);
    expect(registry.storage["s3-compatible"]).toHaveBeenCalledOnce();
    expect(registry.vectorStore.pgvector).toHaveBeenCalledOnce();
    expect(registry.llm.anthropic).toHaveBeenCalledOnce();
    expect(registry.embedding.local).toHaveBeenCalledOnce();
    expect(registry.auth.jwt).toHaveBeenCalledOnce();
    expect(registry.queue.redis).toHaveBeenCalledOnce();
    expect(registry.email.smtp).toHaveBeenCalledOnce();
  });

  it("fails fast when the selected adapter is not registered", () => {
    const providers = createProviderStubs();
    const registry: ProviderRegistry = {
      ...createLocalRegistry(providers),
      email: {},
    };

    expect(() =>
      ProviderFactory.fromEnv(registry, {}).createProviders(),
    ).toThrow(
      new ProviderNotRegisteredError("email", "smtp"),
    );
  });

  it("composes the JWT adapter from environment config", () => {
    const repository = Object.freeze({}) as IAuthRepository;

    expect(
      createAuthProviderFromEnv(repository, {
        AUTH_PROVIDER: "jwt",
        JWT_SECRET: "test-secret-with-at-least-32-characters",
      }),
    ).toBeInstanceOf(JwtAuthProvider);
  });

  it("composes the S3-compatible storage adapter from environment config", () => {
    expect(
      createStorageProviderFromEnv({
        STORAGE_ACCESS_KEY: "minio-access",
        STORAGE_BUCKET: "smartstudy-documents",
        STORAGE_ENDPOINT: "http://localhost:9000",
        STORAGE_SECRET_KEY: "minio-secret",
      }),
    ).toBeInstanceOf(S3CompatibleStorageProvider);
  });

  it("composes the Redis queue adapter from environment config", () => {
    expect(
      createQueueProviderFromEnv({
        QUEUE_PROVIDER: "redis",
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toBeInstanceOf(RedisQueueProvider);
  });

  it("composes the local BGE-M3 embedding adapter", () => {
    expect(
      createEmbeddingProviderFromEnv({
        EMBEDDING_PROVIDER: "local",
      }),
    ).toBeInstanceOf(LocalBgeM3Provider);
  });

  it("composes the Anthropic LLM adapter", () => {
    expect(
      createLLMProviderFromEnv({
        ANTHROPIC_API_KEY: "test-api-key",
        LLM_PROVIDER: "anthropic",
      }),
    ).toBeInstanceOf(AnthropicLLMProvider);
  });
  it("defers missing LLM configuration until the provider is used", async () => {
    const provider = createLazyLLMProviderFromEnv({
      LLM_PROVIDER: "anthropic",
    });

    await expect(
      provider.generateText({
        messages: [{ content: "Question", role: "user" }],
      }),
    ).rejects.toThrow(ProviderConfigurationError);
  });

  it("composes the PgVector vector store adapter", () => {
    const prisma = Object.freeze({}) as PrismaClient;

    expect(
      createVectorStoreFromEnv(prisma, {
        VECTOR_STORE: "pgvector",
      }),
    ).toBeInstanceOf(PgVectorStore);
  });

  it("fails fast for an auth adapter that is not implemented yet", () => {
    const repository = Object.freeze({}) as IAuthRepository;

    expect(() =>
      createAuthProviderFromEnv(repository, {
        AUTH_PROVIDER: "cognito",
      }),
    ).toThrow(
      new ProviderNotRegisteredError("auth", "cognito"),
    );
  });

  it("fails fast for a queue adapter that is not implemented yet", () => {
    expect(() =>
      createQueueProviderFromEnv({
        QUEUE_PROVIDER: "sqs",
      }),
    ).toThrow(
      new ProviderNotRegisteredError("queue", "sqs"),
    );
  });

  it("fails fast for AI adapters that are not implemented yet", () => {
    expect(() =>
      createEmbeddingProviderFromEnv({
        EMBEDDING_PROVIDER: "bedrock",
      }),
    ).toThrow(
      new ProviderNotRegisteredError("embedding", "bedrock"),
    );
    expect(() =>
      createLLMProviderFromEnv({
        LLM_PROVIDER: "bedrock",
      }),
    ).toThrow(new ProviderNotRegisteredError("llm", "bedrock"));
  });

  it("fails fast for a vector store adapter that is not implemented yet", () => {
    const prisma = Object.freeze({}) as PrismaClient;

    expect(() =>
      createVectorStoreFromEnv(prisma, {
        VECTOR_STORE: "bedrock-kb",
      }),
    ).toThrow(
      new ProviderNotRegisteredError("vectorStore", "bedrock-kb"),
    );
  });
});
