import { describe, expect, it } from "vitest";

import { DynamoDbDocumentRepository } from "../src/adapters/documents/dynamodb-document-repository.js";

interface CommandWithInput {
  readonly input: Record<string, unknown>;
}

class FakeDynamoDbClient {
  readonly commands: unknown[] = [];

  constructor(private readonly responses: unknown[]) {}

  async send(command: unknown): Promise<unknown> {
    this.commands.push(command);
    const response = this.responses.shift();

    if (response instanceof Error) {
      throw response;
    }

    return response ?? {};
  }
}

function inputOf(command: unknown): Record<string, unknown> {
  return (command as CommandWithInput).input;
}

describe("DynamoDbDocumentRepository", () => {
  it("creates an owned uploading document with DynamoDB-safe fields", async () => {
    const client = new FakeDynamoDbClient([{}]);
    const repository = new DynamoDbDocumentRepository(
      { chunksTableName: "chunks", documentsTableName: "documents" },
      {
        client,
        now: () => new Date("2026-07-12T00:00:00.000Z"),
      },
    );

    const document = await repository.createUploading({
      fileKey: "users/user-1/documents/document-1.pdf",
      id: "document-1",
      sizeBytes: 123,
      title: "Introduction to AI",
      userId: "user-1",
    });

    expect(document).toMatchObject({
      chapters: [],
      id: "document-1",
      status: "uploading",
      userId: "user-1",
    });
    expect(inputOf(client.commands[0])).toMatchObject({
      ConditionExpression: "attribute_not_exists(documentId)",
      Item: {
        deleted: false,
        documentId: "document-1",
        ownerId: "user-1",
        status: "uploading",
      },
      TableName: "documents",
    });
  });

  it("does not expose a document to a different owner", async () => {
    const client = new FakeDynamoDbClient([
      {
        Item: {
          chapters: [],
          createdAt: "2026-07-12T00:00:00.000Z",
          deleted: false,
          documentId: "document-1",
          fileKey: "document-1.pdf",
          ownerId: "user-1",
          status: "ready",
          title: "Private document",
        },
      },
    ]);
    const repository = new DynamoDbDocumentRepository(
      { chunksTableName: "chunks", documentsTableName: "documents" },
      { client },
    );

    await expect(
      repository.findOwnedById("document-1", "user-2"),
    ).resolves.toBeNull();
  });

  it("returns false when a status transition loses its conditional update", async () => {
    const client = new FakeDynamoDbClient([
      Object.assign(new Error("conditional failure"), {
        name: "ConditionalCheckFailedException",
      }),
    ]);
    const repository = new DynamoDbDocumentRepository(
      { chunksTableName: "chunks", documentsTableName: "documents" },
      { client },
    );

    await expect(repository.markProcessing("document-1", "user-1")).resolves.toBe(
      false,
    );
    expect(inputOf(client.commands[0])).toMatchObject({
      ExpressionAttributeValues: {
        ":current": "uploading",
        ":next": "processing",
        ":ownerId": "user-1",
      },
      Key: { documentId: "document-1" },
      TableName: "documents",
    });
  });

  it("lists chunks only after verifying document ownership", async () => {
    const client = new FakeDynamoDbClient([
      {
        Item: {
          chapters: [],
          createdAt: "2026-07-12T00:00:00.000Z",
          deleted: false,
          documentId: "document-1",
          fileKey: "document-1.pdf",
          ownerId: "user-1",
          status: "ready",
          title: "Document",
        },
      },
      {
        Items: [
          {
            chapterTitle: "Chapter 1",
            chunkId: "chunk-2",
            chunkText: "Second page",
            pageEnd: 2,
            pageStart: 2,
          },
          {
            chapterTitle: "Chapter 1",
            chunkId: "chunk-1",
            chunkText: "First page",
            pageEnd: 1,
            pageStart: 1,
          },
        ],
      },
    ]);
    const repository = new DynamoDbDocumentRepository(
      { chunksTableName: "chunks", documentsTableName: "documents" },
      { client },
    );

    await expect(
      repository.listChunks({ documentId: "document-1", userId: "user-1" }),
    ).resolves.toMatchObject([
      { id: "chunk-1", pageStart: 1 },
      { id: "chunk-2", pageStart: 2 },
    ]);
  });

  it("filters, sorts, and paginates documents from the owner index", async () => {
    const client = new FakeDynamoDbClient([
      {
        Items: [
          documentItem({ createdAt: "2026-07-11T00:00:00.000Z", documentId: "old" }),
          documentItem({ createdAt: "2026-07-12T00:00:00.000Z", documentId: "new" }),
          documentItem({ deleted: true, documentId: "deleted" }),
          documentItem({ documentId: "failed", status: "failed" }),
        ],
      },
    ]);
    const repository = new DynamoDbDocumentRepository(
      { chunksTableName: "chunks", documentsTableName: "documents" },
      { client },
    );

    await expect(
      repository.listOwned({ limit: 1, page: 1, status: "uploading", userId: "user-1" }),
    ).resolves.toMatchObject({ documents: [{ id: "new" }], total: 2 });
    expect(inputOf(client.commands[0])).toMatchObject({
      IndexName: "ownerId-createdAt-index",
      KeyConditionExpression: "ownerId = :ownerId",
      TableName: "documents",
    });
  });

  it("writes chunks before making a processing document ready", async () => {
    const client = new FakeDynamoDbClient([{}, {}]);
    const ids = ["chunk-1", "chunk-2"];
    const repository = new DynamoDbDocumentRepository(
      { chunksTableName: "chunks", documentsTableName: "documents" },
      { client, newId: () => ids.shift() ?? "unexpected" },
    );

    await expect(
      repository.replaceChunksAndMarkReady({
        chapters: [{ chapterTitle: "Chapter 1", endPage: 2, startPage: 1 }],
        chunks: [
          {
            chapterTitle: "Chapter 1",
            chunkText: "First",
            embedding: [0.1],
            pageEnd: 1,
            pageStart: 1,
          },
          {
            chapterTitle: null,
            chunkText: "Second",
            embedding: [0.2],
            pageEnd: 2,
            pageStart: 2,
          },
        ],
        documentId: "document-1",
        pageCount: 2,
        userId: "user-1",
      }),
    ).resolves.toBe(true);
    expect(inputOf(client.commands[0])).toMatchObject({
      RequestItems: {
        chunks: [
          { PutRequest: { Item: { chunkId: "chunk-1", documentId: "document-1" } } },
          { PutRequest: { Item: { chunkId: "chunk-2", documentId: "document-1" } } },
        ],
      },
    });
    expect(inputOf(client.commands[1])).toMatchObject({
      Key: { documentId: "document-1" },
      TableName: "documents",
      UpdateExpression:
        "SET chapters = :chapters, pageCount = :pageCount, #status = :ready",
    });
  });

  it("returns false for a failed soft delete condition", async () => {
    const client = new FakeDynamoDbClient([
      Object.assign(new Error("conditional failure"), {
        name: "ConditionalCheckFailedException",
      }),
    ]);
    const repository = new DynamoDbDocumentRepository(
      { chunksTableName: "chunks", documentsTableName: "documents" },
      { client },
    );

    await expect(repository.softDeleteOwned("document-1", "user-1")).resolves.toBe(
      false,
    );
  });
});

function documentItem(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    chapters: [],
    createdAt: "2026-07-12T00:00:00.000Z",
    deleted: false,
    documentId: "document-1",
    fileKey: "document-1.pdf",
    ownerId: "user-1",
    status: "uploading",
    title: "Document",
    ...overrides,
  };
}
