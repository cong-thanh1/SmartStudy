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

export function createTestApp(
  authProvider: IAuthProvider,
  documentService: IDocumentService = createDocumentServiceStub(),
  chatService: IChatService = createChatServiceStub(),
) {
  return createApp({
    authProvider,
    chatService,
    documentConfig: testDocumentConfig,
    documentService,
  });
}
