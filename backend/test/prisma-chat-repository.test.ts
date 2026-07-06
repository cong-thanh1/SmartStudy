import { describe, expect, it, vi } from "vitest";

import { PrismaChatRepository } from "../src/adapters/chat/prisma-chat-repository.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const createdAt = new Date("2026-07-06T01:00:00.000Z");
const conversationId = "33333333-3333-4333-8333-333333333333";
const documentId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

interface DatabaseConversationStub {
  readonly createdAt: Date;
  readonly documentId: string | null;
  readonly id: string;
  readonly title: string | null;
  readonly userId: string;
}

const databaseConversation: DatabaseConversationStub = {
  createdAt,
  documentId,
  id: conversationId,
  title: "Physics Notes",
  userId,
};

const databaseUserMessage = {
  citations: [],
  content: "What is inertia?",
  conversationId,
  createdAt,
  id: "user-message",
  role: "user",
};

const databaseAssistantMessage = {
  citations: [
    {
      document_id: documentId,
      page: 2,
      snippet: "Objects resist changes in motion.",
    },
  ],
  content: "Inertia is resistance to changes in motion.",
  conversationId,
  createdAt,
  id: "assistant-message",
  role: "assistant",
};

function createPrismaStub() {
  const transaction = {
    message: {
      create: vi.fn(async (input: { data: { role: string } }) =>
        input.data.role === "user"
          ? databaseUserMessage
          : databaseAssistantMessage,
      ),
    },
  };

  return {
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
    __transaction: transaction,
    conversation: {
      create: vi.fn(async () => databaseConversation),
      findFirst: vi.fn(
        async (): Promise<DatabaseConversationStub | null> =>
          databaseConversation,
      ),
    },
    message: {
      findMany: vi.fn(async () => [
        databaseAssistantMessage,
        databaseUserMessage,
      ]),
    },
  };
}

describe("PrismaChatRepository", () => {
  it("creates and maps a document conversation", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaChatRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.createConversation({
        documentId,
        title: "Physics Notes",
        userId,
      }),
    ).resolves.toEqual(databaseConversation);
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: {
        documentId,
        title: "Physics Notes",
        userId,
      },
      select: expect.any(Object),
    });
  });

  it("finds only a user's document-backed conversation", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaChatRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.findOwnedConversation(conversationId, userId),
    ).resolves.toEqual(databaseConversation);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      select: expect.any(Object),
      where: {
        documentId: {
          not: null,
        },
        id: conversationId,
        userId,
      },
    });

    prisma.conversation.findFirst.mockResolvedValueOnce(null);
    await expect(
      repository.findOwnedConversation(conversationId, "another-user"),
    ).resolves.toBeNull();
  });

  it("returns recent messages in chronological order", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaChatRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.listRecentMessages(conversationId, 10),
    ).resolves.toEqual([
      {
        ...databaseUserMessage,
        citations: [],
      },
      {
        ...databaseAssistantMessage,
        citations: [
          {
            documentId,
            page: 2,
            snippet: "Objects resist changes in motion.",
          },
        ],
      },
    ]);
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: expect.any(Object),
      take: 10,
      where: {
        conversationId,
      },
    });
  });

  it("atomically appends a user and assistant exchange", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaChatRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.appendExchange({
        assistantContent: "Inertia is resistance to changes in motion.",
        citations: [
          {
            documentId,
            page: 2,
            snippet: "Objects resist changes in motion.",
          },
        ],
        conversationId,
        userContent: "What is inertia?",
      }),
    ).resolves.toEqual({
      assistantMessage: {
        ...databaseAssistantMessage,
        citations: [
          {
            documentId,
            page: 2,
            snippet: "Objects resist changes in motion.",
          },
        ],
      },
      userMessage: databaseUserMessage,
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.__transaction.message.create).toHaveBeenNthCalledWith(1, {
      data: {
        citations: [],
        content: "What is inertia?",
        conversationId,
        role: "user",
      },
      select: expect.any(Object),
    });
    expect(prisma.__transaction.message.create).toHaveBeenNthCalledWith(2, {
      data: {
        citations: [
          {
            document_id: documentId,
            page: 2,
            snippet: "Objects resist changes in motion.",
          },
        ],
        content: "Inertia is resistance to changes in motion.",
        conversationId,
        role: "assistant",
      },
      select: expect.any(Object),
    });
  });

  it("rejects a conversation without a document", async () => {
    const prisma = createPrismaStub();
    prisma.conversation.findFirst.mockResolvedValueOnce({
      ...databaseConversation,
      documentId: null,
    });
    const repository = new PrismaChatRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.findOwnedConversation(conversationId, userId),
    ).rejects.toThrow("must reference a document");
  });

  it("rejects corrupt message roles and citations", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaChatRepository(
      prisma as unknown as PrismaClient,
    );

    prisma.message.findMany.mockResolvedValueOnce([
      {
        ...databaseUserMessage,
        role: "system",
      },
    ]);
    await expect(
      repository.listRecentMessages(conversationId, 10),
    ).rejects.toThrow("Unsupported chat message role");

    prisma.message.findMany.mockResolvedValueOnce([
      {
        ...databaseAssistantMessage,
        citations: [{ document_id: documentId, page: 0, snippet: "bad" }],
      },
    ]);
    await expect(
      repository.listRecentMessages(conversationId, 10),
    ).rejects.toThrow("Chat citation 0");
  });
});