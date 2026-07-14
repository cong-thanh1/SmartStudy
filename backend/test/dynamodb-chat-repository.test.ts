import { describe, expect, it } from "vitest";

import { DynamoDbChatRepository } from "../src/adapters/chat/dynamodb-chat-repository.js";

interface CommandWithInput {
  readonly input: Record<string, unknown>;
}

class FakeDynamoDbClient {
  readonly commands: unknown[] = [];

  constructor(private readonly responses: unknown[]) {}

  async send(command: unknown): Promise<unknown> {
    this.commands.push(command);
    return this.responses.shift() ?? {};
  }
}

function inputOf(command: unknown): Record<string, unknown> {
  return (command as CommandWithInput).input;
}

describe("DynamoDbChatRepository", () => {
  it("creates a conversation with owner and document identifiers", async () => {
    const client = new FakeDynamoDbClient([{}]);
    const repository = createRepository(client, ["conversation-1"]);

    await expect(
      repository.createConversation({
        documentId: "document-1",
        title: "AI revision",
        userId: "user-1",
      }),
    ).resolves.toMatchObject({
      documentId: "document-1",
      id: "conversation-1",
      title: "AI revision",
      userId: "user-1",
    });
    expect(inputOf(client.commands[0])).toMatchObject({
      Item: {
        conversationId: "conversation-1",
        documentId: "document-1",
        ownerId: "user-1",
      },
      TableName: "conversations",
    });
  });

  it("does not return another user's conversation", async () => {
    const client = new FakeDynamoDbClient([
      {
        Item: {
          conversationId: "conversation-1",
          createdAt: "2026-07-12T00:00:00.000Z",
          documentId: "document-1",
          ownerId: "user-1",
          title: "Private",
        },
      },
    ]);
    const repository = createRepository(client);

    await expect(
      repository.findOwnedConversation("conversation-1", "user-2"),
    ).resolves.toBeNull();
  });

  it("lists the newest conversations for one owned document", async () => {
    const client = new FakeDynamoDbClient([
      {
        Items: [
          {
            conversationId: "conversation-1",
            createdAt: "2026-07-12T00:00:00.000Z",
            documentId: "document-1",
            ownerId: "user-1",
            title: "Private",
          },
        ],
      },
    ]);
    const repository = createRepository(client);

    await expect(repository.listOwnedByDocument("document-1", "user-1")).resolves.toMatchObject([
      { id: "conversation-1" },
    ]);
    expect(inputOf(client.commands[0])).toMatchObject({
      FilterExpression: "documentId = :documentId",
      IndexName: "ownerId-createdAt-index",
      KeyConditionExpression: "ownerId = :ownerId",
      ScanIndexForward: false,
      TableName: "conversations",
    });
  });

  it("writes a user/assistant exchange atomically after checking the conversation", async () => {
    const client = new FakeDynamoDbClient([{}]);
    const repository = createRepository(client, ["user-message", "assistant-message"]);

    const exchange = await repository.appendExchange({
      assistantContent: "The answer is in chapter one.",
      citations: [{ documentId: "document-1", page: 2, snippet: "Relevant text" }],
      conversationId: "conversation-1",
      userContent: "What is the answer?",
    });

    expect(exchange).toMatchObject({
      assistantMessage: { id: "assistant-message", role: "assistant" },
      userMessage: { id: "user-message", role: "user" },
    });
    const transactionItems = inputOf(client.commands[0]).TransactItems as readonly Record<
      string,
      unknown
    >[];
    expect(transactionItems[0]).toMatchObject({
      ConditionCheck: {
        Key: { conversationId: "conversation-1" },
        TableName: "conversations",
      },
    });
    expect(transactionItems[1]).toMatchObject({
      Put: {
        Item: {
          messageSortKey: "2026-07-12T00:00:00.000Z#0#user-message",
          role: "user",
        },
      },
    });
    expect(transactionItems[2]).toMatchObject({
      Put: {
        Item: {
          messageSortKey: "2026-07-12T00:00:00.000Z#1#assistant-message",
          role: "assistant",
        },
      },
    });
  });

  it("returns recent messages in chronological order", async () => {
    const client = new FakeDynamoDbClient([
      {
        Items: [
          messageItem({ createdAt: "2026-07-12T00:00:02.000Z", messageId: "two" }),
          messageItem({ createdAt: "2026-07-12T00:00:01.000Z", messageId: "one" }),
        ],
      },
    ]);
    const repository = createRepository(client);

    await expect(repository.listRecentMessages("conversation-1", 10)).resolves.toMatchObject([
      { id: "one" },
      { id: "two" },
    ]);
    expect(inputOf(client.commands[0])).toMatchObject({
      Limit: 10,
      ScanIndexForward: false,
      TableName: "messages",
    });
  });

  it("puts a legacy user question above its assistant answer at the same time", async () => {
    const client = new FakeDynamoDbClient([
      {
        Items: [
          messageItem({ messageId: "assistant", role: "assistant" }),
          messageItem({ messageId: "user", role: "user" }),
        ],
      },
    ]);
    const repository = createRepository(client);

    await expect(repository.listRecentMessages("conversation-1", 10)).resolves.toMatchObject([
      { id: "user", role: "user" },
      { id: "assistant", role: "assistant" },
    ]);
  });
});

function createRepository(
  client: FakeDynamoDbClient,
  ids: string[] = [],
): DynamoDbChatRepository {
  return new DynamoDbChatRepository(
    { conversationMessagesTableName: "messages", conversationsTableName: "conversations" },
    {
      client,
      newId: () => ids.shift() ?? "generated-id",
      now: () => new Date("2026-07-12T00:00:00.000Z"),
    },
  );
}

function messageItem(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    citations: [],
    content: "Message",
    conversationId: "conversation-1",
    createdAt: "2026-07-12T00:00:00.000Z",
    messageId: "message-1",
    messageSortKey: "2026-07-12T00:00:00.000Z#message-1",
    role: "user",
    ...overrides,
  };
}
