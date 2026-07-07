import "dotenv/config";

import { PrismaAuthRepository } from "./adapters/auth/prisma-auth-repository.js";
import { PrismaChatRepository } from "./adapters/chat/prisma-chat-repository.js";
import { PrismaDocumentRepository } from "./adapters/documents/prisma-document-repository.js";
import { PrismaSummaryRepository } from "./adapters/summary/prisma-summary-repository.js";
import { createApp } from "./app.js";
import { createPrismaClient } from "./database/prisma-client.js";
import { ChatService } from "./modules/chat/chat-service.js";
import { loadDocumentConfig } from "./modules/documents/document-config.js";
import { DocumentService } from "./modules/documents/document-service.js";
import { SummaryService } from "./modules/summary/summary-service.js";
import {
  createAuthProviderFromEnv,
  createEmbeddingProviderFromEnv,
  createLazyLLMProviderFromEnv,
  createQueueProviderFromEnv,
  createStorageProviderFromEnv,
  createVectorStoreFromEnv,
} from "./provider-factory.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const prisma = createPrismaClient(databaseUrl);
const authRepository = new PrismaAuthRepository(prisma);
const authProvider = createAuthProviderFromEnv(authRepository);
const documentRepository = new PrismaDocumentRepository(prisma);
const documentConfig = loadDocumentConfig();
const queueProvider = createQueueProviderFromEnv();
const storageProvider = createStorageProviderFromEnv();
const embeddingProvider = createEmbeddingProviderFromEnv();
const llmProvider = createLazyLLMProviderFromEnv();
const vectorStore = createVectorStoreFromEnv(prisma);
const documentService = new DocumentService(
  documentRepository,
  storageProvider,
  queueProvider,
  documentConfig,
);
const chatService = new ChatService(
  new PrismaChatRepository(prisma),
  documentRepository,
  embeddingProvider,
  vectorStore,
  llmProvider,
);
const summaryService = new SummaryService(
  new PrismaSummaryRepository(prisma),
  documentRepository,
  llmProvider,
);
const app = createApp({
  authProvider,
  chatService,
  documentConfig,
  documentService,
  summaryService,
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      event: "api_started",
      port,
      service: "smartstudy-api",
    }),
  );
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(JSON.stringify({ event: "api_stopping", signal }));
  server.close((error) => {
    void closeResources(error);
  });
}

async function closeResources(serverError?: Error): Promise<void> {
  if (serverError) {
    console.error(
      JSON.stringify({
        error: {
          name: serverError.name,
        },
        event: "api_stop_failed",
      }),
    );
    process.exitCode = 1;
  }

  try {
    await Promise.all([
      prisma.$disconnect(),
      queueProvider.close(),
    ]);
  } catch (error) {
    console.error(
      JSON.stringify({
        error: {
          name: error instanceof Error ? error.name : "UnknownError",
        },
        event: "api_resource_close_failed",
      }),
    );
    process.exitCode = 1;
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
