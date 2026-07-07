import { vi } from "vitest";

import { createApp } from "../src/app.js";
import {
  DEFAULT_DOCUMENT_CHUNK_MAX_TOKENS,
  DEFAULT_DOCUMENT_CHUNK_OVERLAP_TOKENS,
  DEFAULT_DOCUMENT_MAX_SIZE_BYTES,
  type DocumentConfig,
} from "../src/modules/documents/document-config.js";
import type { IChatService } from "../src/modules/chat/chat-service.js";
import type { IDocumentService } from "../src/modules/documents/document-service.js";
import type { IExamService } from "../src/modules/exam/exam-service.js";
import type { IQuizService } from "../src/modules/quiz/quiz-service.js";
import type { ISummaryService } from "../src/modules/summary/summary-service.js";
import type { ITutorService } from "../src/modules/tutor/tutor-service.js";
import type { IAuthProvider } from "../src/ports/index.js";

export const testDocumentConfig: DocumentConfig = {
  chunkMaxTokens: DEFAULT_DOCUMENT_CHUNK_MAX_TOKENS,
  chunkOverlapTokens: DEFAULT_DOCUMENT_CHUNK_OVERLAP_TOKENS,
  maxFileSizeBytes: DEFAULT_DOCUMENT_MAX_SIZE_BYTES,
  processingAttempts: 3,
  processingQueue: "document-processing",
  uploadUrlExpiresSeconds: 900,
};

export function createChatServiceStub(): IChatService {
  return {
    createConversation: vi.fn(),
    sendMessage: vi.fn(),
  };
}

export function createDocumentServiceStub(): IDocumentService {
  return {
    completeUpload: vi.fn(),
    deleteDocument: vi.fn(),
    getDocument: vi.fn(),
    listDocuments: vi.fn(),
    requestUpload: vi.fn(),
  };
}

export function createSummaryServiceStub(): ISummaryService {
  return {
    getChapterSummary: vi.fn(),
    getFullDocumentSummary: vi.fn(),
    summarizeChapter: vi.fn(),
    summarizeFullDocument: vi.fn(),
  };
}

export function createTestApp(
  authProvider: IAuthProvider,
  documentService: IDocumentService = createDocumentServiceStub(),
  chatService: IChatService = createChatServiceStub(),
  summaryService: ISummaryService = createSummaryServiceStub(),
  quizService?: IQuizService,
  examService?: IExamService,
  tutorService?: ITutorService,
) {
  return createApp({
    authProvider,
    chatService,
    documentConfig: testDocumentConfig,
    documentService,
    ...(examService === undefined ? {} : { examService }),
    ...(quizService === undefined ? {} : { quizService }),
    summaryService,
    ...(tutorService === undefined ? {} : { tutorService }),
  });
}
