import { describe, expect, it, vi } from "vitest";

import { ConversationNotFoundError } from "../src/modules/chat/chat-errors.js";
import type {
  ChatMessageRecord,
  ConversationRecord,
  IChatRepository,
} from "../src/modules/chat/chat-repository.js";
import { ChatService } from "../src/modules/chat/chat-service.js";
import type {
  DocumentRecord,
  IDocumentRepository,
} from "../src/modules/documents/document-repository.js";
import type {
  GenerateTextInput,
  IEmbeddingProvider,
  ILLMProvider,
  IVectorStore,
  VectorSearchResult,
} from "../src/ports/index.js";

const createdAt = new Date("2026-07-06T02:00:00.000Z");
const userOneId = "11111111-1111-4111-8111-111111111111";
const userTwoId = "22222222-2222-4222-8222-222222222222";
const userOneDocumentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userTwoDocumentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userOneConversationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const userTwoConversationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

interface OwnedSource extends VectorSearchResult {
  readonly ownerUserId: string;
}

const documents = new Map<string, DocumentRecord>([
  [
    documentKey(userOneDocumentId, userOneId),
    createDocument({
      id: userOneDocumentId,
      title: "User one biology notes",
      userId: userOneId,
    }),
  ],
  [
    documentKey(userTwoDocumentId, userTwoId),
    createDocument({
      id: userTwoDocumentId,
      title: "User two private notes",
      userId: userTwoId,
    }),
  ],
]);

const conversations = new Map<string, ConversationRecord>([
  [
    conversationKey(userOneConversationId, userOneId),
    createConversation({
      documentId: userOneDocumentId,
      id: userOneConversationId,
      title: "User one biology notes",
      userId: userOneId,
    }),
  ],
  [
    conversationKey(userTwoConversationId, userTwoId),
    createConversation({
      documentId: userTwoDocumentId,
      id: userTwoConversationId,
      title: "User two private notes",
      userId: userTwoId,
    }),
  ],
]);

const sourceFixture: readonly OwnedSource[] = [
  {
    documentId: userOneDocumentId,
    id: "user-one-chunk",
    ownerUserId: userOneId,
    pageStart: 5,
    similarity: 0.92,
    text: "Owned biology context: mitochondria generate ATP for the cell.",
  },
  {
    documentId: userTwoDocumentId,
    id: "user-two-private-chunk",
    ownerUserId: userTwoId,
    pageStart: 7,
    similarity: 0.99,
    text: "Other user's private context: the exam password is swordfish.",
  },
];

describe("RAG user isolation", () => {
  it("grounds chat answers only with chunks owned by the requesting user", async () => {
    const { chatRepository, llmProvider, service, vectorStore } =
      createIsolationService();

    const result = await service.sendMessage({
      content: " What do mitochondria do? ",
      conversationId: userOneConversationId,
      userId: userOneId,
    });

    expect(vectorStore.similaritySearch).toHaveBeenCalledWith({
      documentId: userOneDocumentId,
      embedding: expect.any(Array),
      topK: 5,
      userId: userOneId,
    });

    const generation = vi.mocked(llmProvider.generateText).mock.calls[0]?.[0];
    expect(generation?.systemPrompt).toContain("Owned biology context");
    expect(generation?.systemPrompt).not.toContain("Other user's private context");
    expect(generation?.systemPrompt).not.toContain("swordfish");

    const appendInput = vi.mocked(chatRepository.appendExchange).mock
      .calls[0]?.[0];
    expect(appendInput?.citations).toEqual([
      {
        documentId: userOneDocumentId,
        page: 5,
        snippet:
          "Owned biology context: mitochondria generate ATP for the cell.",
      },
    ]);
    expect(result.assistantMessage.citations).toEqual(appendInput?.citations);
  });

  it("rejects cross-user conversation access before embedding or retrieval", async () => {
    const { chatRepository, embeddingProvider, llmProvider, service, vectorStore } =
      createIsolationService();

    await expect(
      service.sendMessage({
        content: "Can I read this?",
        conversationId: userOneConversationId,
        userId: userTwoId,
      }),
    ).rejects.toThrow(ConversationNotFoundError);

    expect(chatRepository.findOwnedConversation).toHaveBeenCalledWith(
      userOneConversationId,
      userTwoId,
    );
    expect(embeddingProvider.embed).not.toHaveBeenCalled();
    expect(vectorStore.similaritySearch).not.toHaveBeenCalled();
    expect(llmProvider.generateText).not.toHaveBeenCalled();
  });
});

function createIsolationService() {
  const chatRepository = createChatRepository();
  const documentRepository = createDocumentRepository();
  const embeddingProvider = createEmbeddingProvider();
  const vectorStore = createVectorStore();
  const llmProvider = createLLMProvider();
  const service = new ChatService(
    chatRepository,
    documentRepository,
    embeddingProvider,
    vectorStore,
    llmProvider,
  );

  return {
    chatRepository,
    documentRepository,
    embeddingProvider,
    llmProvider,
    service,
    vectorStore,
  };
}

function createChatRepository(): IChatRepository {
  return {
    appendExchange: vi.fn(async (input) => ({
      assistantMessage: createMessage({
        citations: input.citations,
        content: input.assistantContent,
        id: "assistant-message",
        role: "assistant",
      }),
      userMessage: createMessage({
        content: input.userContent,
        id: "user-message",
        role: "user",
      }),
    })),
    createConversation: vi.fn(async (input) =>
      createConversation({
        documentId: input.documentId,
        id: userOneConversationId,
        title: input.title,
        userId: input.userId,
      }),
    ),
    findOwnedConversation: vi.fn(async (conversationId, userId) =>
      conversations.get(conversationKey(conversationId, userId)) ?? null,
    ),
    listRecentMessages: vi.fn(async () => []),
  };
}

function createDocumentRepository(): IDocumentRepository {
  return {
    createUploading: vi.fn(),
    findOwnedById: vi.fn(async (documentId, userId) =>
      documents.get(documentKey(documentId, userId)) ?? null,
    ),
    listOwned: vi.fn(),
    markFailed: vi.fn(),
    markProcessing: vi.fn(),
    replaceChunksAndMarkReady: vi.fn(),
    softDeleteOwned: vi.fn(),
  };
}

function createEmbeddingProvider(): IEmbeddingProvider {
  return {
    dimensions: 1024,
    embed: vi.fn(async () => Array.from({ length: 1024 }, () => 0.25)),
    embedBatch: vi.fn(async () => []),
  };
}

function createVectorStore(): IVectorStore {
  return {
    deleteByDocument: vi.fn(async () => undefined),
    similaritySearch: vi.fn(async (query) =>
      sourceFixture
        .filter(
          (source) =>
            source.documentId === query.documentId &&
            source.ownerUserId === query.userId,
        )
        .map(stripOwner),
    ),
    upsertEmbeddings: vi.fn(async () => undefined),
  };
}

function createLLMProvider(): ILLMProvider {
  return {
    generateStructuredJSON: vi.fn(),
    generateText: vi.fn(async (input: GenerateTextInput) => {
      expect(input.systemPrompt).toContain("Owned biology context");
      expect(input.systemPrompt).not.toContain("Other user's private context");

      return {
        text: "Mitochondria generate ATP for the cell [S1].",
      };
    }),
  };
}

function createDocument(input: {
  readonly id: string;
  readonly title: string;
  readonly userId: string;
}): DocumentRecord {
  return {
    chapters: [],
    createdAt,
    fileKey: `users/${input.userId}/documents/${input.id}.pdf`,
    id: input.id,
    pageCount: 10,
    sizeBytes: 1024,
    status: "ready",
    title: input.title,
    userId: input.userId,
  };
}

function createConversation(input: {
  readonly documentId: string;
  readonly id: string;
  readonly title: string;
  readonly userId: string;
}): ConversationRecord {
  return {
    createdAt,
    documentId: input.documentId,
    id: input.id,
    title: input.title,
    userId: input.userId,
  };
}

function createMessage(input: {
  readonly citations?: ChatMessageRecord["citations"];
  readonly content: string;
  readonly id: string;
  readonly role: ChatMessageRecord["role"];
}): ChatMessageRecord {
  return {
    citations: input.citations ?? [],
    content: input.content,
    conversationId: userOneConversationId,
    createdAt,
    id: input.id,
    role: input.role,
  };
}

function stripOwner(source: OwnedSource): VectorSearchResult {
  return {
    documentId: source.documentId,
    id: source.id,
    similarity: source.similarity,
    text: source.text,
    ...(source.chapterTitle === undefined
      ? {}
      : { chapterTitle: source.chapterTitle }),
    ...(source.pageEnd === undefined ? {} : { pageEnd: source.pageEnd }),
    ...(source.pageStart === undefined ? {} : { pageStart: source.pageStart }),
  };
}

function documentKey(documentId: string, userId: string): string {
  return `${userId}:${documentId}`;
}

function conversationKey(conversationId: string, userId: string): string {
  return `${userId}:${conversationId}`;
}
