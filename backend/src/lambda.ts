import "dotenv/config";

import { PrismaAuthRepository } from "./adapters/auth/prisma-auth-repository.js";
import { PrismaChatRepository } from "./adapters/chat/prisma-chat-repository.js";
import { PrismaDocumentRepository } from "./adapters/documents/prisma-document-repository.js";
import { PrismaExamRepository } from "./adapters/exam/prisma-exam-repository.js";
import { PrismaQuizRepository } from "./adapters/quiz/prisma-quiz-repository.js";
import { PrismaSummaryRepository } from "./adapters/summary/prisma-summary-repository.js";
import { createApp } from "./app.js";
import { createLambdaHandler } from "./lambda-handler.js";
import { createPrismaClient } from "./database/prisma-client.js";
import { ChatService } from "./modules/chat/chat-service.js";
import { loadDocumentConfig } from "./modules/documents/document-config.js";
import { DocumentService } from "./modules/documents/document-service.js";
import { ExamService } from "./modules/exam/exam-service.js";
import { QuizService } from "./modules/quiz/quiz-service.js";
import { SummaryService } from "./modules/summary/summary-service.js";
import { TutorService } from "./modules/tutor/tutor-service.js";
import {
  createAuthProviderFromEnv,
  createEmbeddingProviderFromEnv,
  createLazyLLMProviderFromEnv,
  createQueueProviderFromEnv,
  createStorageProviderFromEnv,
  createVectorStoreFromEnv,
} from "./provider-factory.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const prisma = createPrismaClient(databaseUrl);
const documentConfig = loadDocumentConfig();
const queueProvider = createQueueProviderFromEnv();
const storageProvider = createStorageProviderFromEnv();
const embeddingProvider = createEmbeddingProviderFromEnv();
const llmProvider = createLazyLLMProviderFromEnv();
const documentRepository = new PrismaDocumentRepository(prisma);
const quizRepository = new PrismaQuizRepository(prisma);
const authProvider = createAuthProviderFromEnv(
  new PrismaAuthRepository(prisma),
);
const documentService = new DocumentService(
  documentRepository,
  storageProvider,
  queueProvider,
  documentConfig,
);
const app = createApp({
  authProvider,
  chatService: new ChatService(
    new PrismaChatRepository(prisma),
    documentRepository,
    embeddingProvider,
    createVectorStoreFromEnv(prisma),
    llmProvider,
  ),
  documentConfig,
  documentService,
  examService: new ExamService(
    new PrismaExamRepository(prisma),
    documentRepository,
    quizRepository,
    llmProvider,
  ),
  quizService: new QuizService(quizRepository, documentRepository, llmProvider),
  summaryService: new SummaryService(
    new PrismaSummaryRepository(prisma),
    documentRepository,
    llmProvider,
  ),
  tutorService: new TutorService(documentRepository, llmProvider),
});

export const handler = createLambdaHandler(app);
