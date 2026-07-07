import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import type { DocumentConfig } from "../src/modules/documents/document-config.js";
import { DocumentProcessingService } from "../src/modules/documents/document-processing-service.js";
import type {
  DocumentChunkInput,
  DocumentRecord,
  IDocumentRepository,
} from "../src/modules/documents/document-repository.js";
import { DocumentService } from "../src/modules/documents/document-service.js";
import type { ExtractedPdfDocument, IPdfTextExtractor } from "../src/modules/documents/pdf-processing.js";
import type {
  ChatMessageRecord,
  ConversationRecord,
  IChatRepository,
} from "../src/modules/chat/chat-repository.js";
import { ChatService } from "../src/modules/chat/chat-service.js";
import type {
  GenerateTextInput,
  IEmbeddingProvider,
  ILLMProvider,
  IQueueProvider,
  IStorageProvider,
  IVectorStore,
  VectorSearchResult,
} from "../src/ports/index.js";

const userId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";
const conversationId = "33333333-3333-4333-8333-333333333333";
const createdAt = new Date("2026-07-06T00:00:00.000Z");
const fileKey = `users/${userId}/documents/${documentId}.pdf`;

const config: DocumentConfig = {
  chunkMaxTokens: 100,
  chunkOverlapTokens: 10,
  maxFileSizeBytes: 10_000_000,
  processingAttempts: 3,
  processingQueue: "document-processing",
  uploadUrlExpiresSeconds: 900,
};

describe("DoD Phase 1: End-to-End RAG workflow", () => {
  it("executes upload PDF -> processing -> chat with citation e2e", async () => {
    let storedDocument: DocumentRecord = {
      chapters: [],
      createdAt,
      fileKey,
      id: documentId,
      pageCount: null,
      sizeBytes: 5000,
      status: "uploading",
      title: "Physics Textbook",
      userId,
    };

    const storedChunks: DocumentChunkInput[] = [];

    const documentRepository: IDocumentRepository = {
      createUploading: vi.fn(async (input) => {
        storedDocument = {
          ...storedDocument,
          id: input.id,
          sizeBytes: input.sizeBytes,
          title: input.title,
          userId: input.userId,
        };
        return storedDocument;
      }),
      findOwnedById: vi.fn(async (id, ownerId) => {
        if (id === documentId && ownerId === userId) {
          return storedDocument;
        }
        return null;
      }),
      listChunks: vi.fn(async () =>
        storedChunks.map((chunk, index) => ({
          chapterTitle: chunk.chapterTitle,
          chunkText: chunk.chunkText,
          id: `chunk-${index}`,
          pageEnd: chunk.pageEnd,
          pageStart: chunk.pageStart,
        })),
      ),
      listOwned: vi.fn(async () => ({ documents: [storedDocument], total: 1 })),
      markFailed: vi.fn(),
      markProcessing: vi.fn(async () => {
        storedDocument = { ...storedDocument, status: "processing" };
      }),
      replaceChunksAndMarkReady: vi.fn(async (input) => {
        storedChunks.push(...input.chunks);
        storedDocument = {
          ...storedDocument,
          chapters: input.chapters,
          pageCount: input.pageCount,
          status: "ready",
        };
        return true;
      }),
      softDeleteOwned: vi.fn(),
    };

    const storageProvider: IStorageProvider = {
      delete: vi.fn(),
      download: vi.fn(async () => Readable.from([Buffer.from("dummy pdf")])),
      getDownloadUrl: vi.fn(),
      getUploadUrl: vi.fn(async () => ({
        expiresAt: new Date(Date.now() + 900_000),
        headers: { "content-type": "application/pdf" },
        method: "PUT",
        url: "https://storage.local.test/upload",
      })),
    };

    const queueProvider: IQueueProvider = {
      close: vi.fn(),
      enqueue: vi.fn(),
    };

    const documentService = new DocumentService(
      documentRepository,
      storageProvider,
      queueProvider,
      config,
    );

    const uploadRequest = await documentService.requestUpload({
      sizeBytes: 5000,
      title: "Physics Textbook",
      userId,
    });
    expect(uploadRequest.document.status).toBe("uploading");
    expect(uploadRequest.upload.url).toBeDefined();

    const completedDoc = await documentService.completeUpload({
      documentId,
      userId,
    });
    expect(completedDoc.status).toBe("processing");
    expect(queueProvider.enqueue).toHaveBeenCalledWith(
      "document-processing",
      expect.objectContaining({ documentId, userId }),
    );

    const pdfExtractor: IPdfTextExtractor = {
      extract: vi.fn(async (): Promise<ExtractedPdfDocument> => ({
        pageCount: 1,
        pages: [
          {
            pageNumber: 1,
            text: "Chapter 1: Newton Laws\nNewton's first law states that an object at rest remains at rest unless acted upon by an external force.",
          },
        ],
      })),
    };

    const embeddingProvider: IEmbeddingProvider = {
      dimensions: 1024,
      embed: vi.fn(async () => Array.from({ length: 1024 }, () => 0.1)),
      embedBatch: vi.fn(async (texts) =>
        texts.map(() => Array.from({ length: 1024 }, () => 0.1)),
      ),
    };

    const processingService = new DocumentProcessingService(
      documentRepository,
      storageProvider,
      embeddingProvider,
      pdfExtractor,
      config,
      {
        readStream: async () => Buffer.from("dummy pdf content"),
      },
    );

    await processingService.processJob({
      data: { documentId, fileKey, userId },
      id: "job-1",
    });

    expect(storedDocument.status).toBe("ready");
    expect(storedChunks.length).toBeGreaterThan(0);

    const conversations = new Map<string, ConversationRecord>();
    const messages: ChatMessageRecord[] = [];

    const chatRepository: IChatRepository = {
      appendExchange: vi.fn(async (input) => {
        const userMsg: ChatMessageRecord = {
          citations: [],
          content: input.userContent,
          conversationId: input.conversationId,
          createdAt,
          id: "user-msg-id",
          role: "user",
        };
        const assistantMsg: ChatMessageRecord = {
          citations: input.citations ?? [],
          content: input.assistantContent,
          conversationId: input.conversationId,
          createdAt,
          id: "assistant-msg-id",
          role: "assistant",
        };
        messages.push(userMsg, assistantMsg);
        return { assistantMessage: assistantMsg, userMessage: userMsg };
      }),
      createConversation: vi.fn(async (input) => {
        const conv: ConversationRecord = {
          createdAt,
          documentId: input.documentId,
          id: conversationId,
          title: input.title,
          userId: input.userId,
        };
        conversations.set(conversationId, conv);
        return conv;
      }),
      findOwnedConversation: vi.fn(async (id, ownerId) => {
        const conv = conversations.get(id);
        if (conv && conv.userId === ownerId) return conv;
        return null;
      }),
      listRecentMessages: vi.fn(async () => []),
    };

    const vectorStore: IVectorStore = {
      deleteByDocument: vi.fn(),
      similaritySearch: vi.fn(async (query): Promise<VectorSearchResult[]> => {
        expect(query.documentId).toBe(documentId);
        expect(query.userId).toBe(userId);
        return storedChunks.map((chunk, index) => ({
          documentId,
          id: `chunk-${index}`,
          pageStart: chunk.pageStart ?? 1,
          similarity: 0.95,
          text: chunk.chunkText,
        }));
      }),
      upsertEmbeddings: vi.fn(),
    };

    const llmProvider: ILLMProvider = {
      generateStructuredJSON: vi.fn(),
      generateText: vi.fn(async (input: GenerateTextInput) => {
        expect(input.systemPrompt).toContain("Newton's first law");
        return {
          text: "An object at rest stays at rest unless acted upon by a force [S1].",
        };
      }),
    };

    const chatService = new ChatService(
      chatRepository,
      documentRepository,
      embeddingProvider,
      vectorStore,
      llmProvider,
    );

    const conv = await chatService.createConversation({
      documentId,
      title: "Newton Discussion",
      userId,
    });
    expect(conv.id).toBe(conversationId);

    const chatResponse = await chatService.sendMessage({
      content: "Explain Newton's first law.",
      conversationId,
      userId,
    });

    expect(chatResponse.assistantMessage.content).toContain(
      "An object at rest stays at rest unless acted upon by a force [S1].",
    );
    expect(chatResponse.assistantMessage.citations).toHaveLength(1);
    expect(chatResponse.assistantMessage.citations[0]).toEqual({
      documentId,
      page: 1,
      snippet: expect.stringContaining("Newton's first law"),
    });
  });
});
