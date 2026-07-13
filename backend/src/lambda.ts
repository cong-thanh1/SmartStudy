import "dotenv/config";

import { DynamoDbChatRepository } from "./adapters/chat/dynamodb-chat-repository.js";
import { DynamoDbDocumentRepository } from "./adapters/documents/dynamodb-document-repository.js";
import { DynamoDbExamRepository } from "./adapters/exam/dynamodb-exam-repository.js";
import { DynamoDbQuizRepository } from "./adapters/quiz/dynamodb-quiz-repository.js";
import { DynamoDbSummaryRepository } from "./adapters/summary/dynamodb-summary-repository.js";
import { DynamoDbAiJobRepository } from "./adapters/jobs/dynamodb-ai-job-repository.js";
import { AiJobService } from "./modules/jobs/ai-job-service.js";
import { createApp } from "./app.js";
import { createLambdaHandler } from "./lambda-handler.js";
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

const documentConfig = loadDocumentConfig();
const queueProvider = createQueueProviderFromEnv();
const storageProvider = createStorageProviderFromEnv();
const embeddingProvider = createEmbeddingProviderFromEnv();
const llmProvider = createLazyLLMProviderFromEnv();
const tableNames = loadTableNames();
const documentRepository = new DynamoDbDocumentRepository({
  chunksTableName: tableNames.documentChunks,
  documentsTableName: tableNames.documents,
});
const quizRepository = new DynamoDbQuizRepository({
  quizzesTableName: tableNames.quizzes,
});
const authProvider = createAuthProviderFromEnv(undefined);
const documentService = new DocumentService(
  documentRepository,
  storageProvider,
  queueProvider,
  documentConfig,
);
const aiJobService = new AiJobService(
  new DynamoDbAiJobRepository(tableNames.aiJobs),
  queueProvider,
  documentConfig.processingQueue,
);
const app = createApp({
  authProvider,
  chatService: new ChatService(
    new DynamoDbChatRepository({
      conversationMessagesTableName: tableNames.conversationMessages,
      conversationsTableName: tableNames.conversations,
    }),
    documentRepository,
    embeddingProvider,
    createVectorStoreFromEnv(undefined, process.env, documentRepository),
    llmProvider,
  ),
  documentConfig,
  documentService,
  aiJobService,
  examService: new ExamService(
    new DynamoDbExamRepository({
      attemptsTableName: tableNames.attempts,
      examsTableName: tableNames.exams,
    }),
    documentRepository,
    quizRepository,
    llmProvider,
  ),
  quizService: new QuizService(quizRepository, documentRepository, llmProvider),
  summaryService: new SummaryService(
    new DynamoDbSummaryRepository(tableNames.summaries),
    documentRepository,
    llmProvider,
  ),
  tutorService: new TutorService(documentRepository, llmProvider),
});

export const handler = createLambdaHandler(app);

function loadTableNames(): {
  readonly aiJobs: string;
  readonly attempts: string;
  readonly conversationMessages: string;
  readonly conversations: string;
  readonly documentChunks: string;
  readonly documents: string;
  readonly exams: string;
  readonly quizzes: string;
  readonly summaries: string;
} {
  const required = [
    "AI_JOBS_TABLE_NAME",
    "ATTEMPTS_TABLE_NAME",
    "CONVERSATION_MESSAGES_TABLE_NAME",
    "CONVERSATIONS_TABLE_NAME",
    "DOCUMENT_CHUNKS_TABLE_NAME",
    "DOCUMENTS_TABLE_NAME",
    "EXAMS_TABLE_NAME",
    "QUIZZES_TABLE_NAME",
    "SUMMARIES_TABLE_NAME",
  ] as const;
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required DynamoDB table configuration: ${missing.join(", ")}`);
  }
  return {
    aiJobs: process.env.AI_JOBS_TABLE_NAME!,
    attempts: process.env.ATTEMPTS_TABLE_NAME!,
    conversationMessages: process.env.CONVERSATION_MESSAGES_TABLE_NAME!,
    conversations: process.env.CONVERSATIONS_TABLE_NAME!,
    documentChunks: process.env.DOCUMENT_CHUNKS_TABLE_NAME!,
    documents: process.env.DOCUMENTS_TABLE_NAME!,
    exams: process.env.EXAMS_TABLE_NAME!,
    quizzes: process.env.QUIZZES_TABLE_NAME!,
    summaries: process.env.SUMMARIES_TABLE_NAME!,
  };
}
