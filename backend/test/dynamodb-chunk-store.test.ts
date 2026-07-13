import { describe, expect, it, vi } from "vitest";

import { DynamoDbChunkStore } from "../src/adapters/vector/dynamodb-chunk-store.js";
import type { IDocumentRepository } from "../src/modules/documents/document-repository.js";

describe("DynamoDbChunkStore", () => {
  it("retrieves only the requesting user's document chunks in relevance order", async () => {
    const listChunks = vi.fn(async () => [
      { chapterTitle: "Introduction", chunkText: "AWS Lambda runs backend application code.", id: "one", pageEnd: 1, pageStart: 1 },
      { chapterTitle: "Storage", chunkText: "Amazon S3 stores PDF documents.", id: "two", pageEnd: 2, pageStart: 2 },
      { chapterTitle: "Lambda", chunkText: "Lambda scales Lambda workloads automatically.", id: "three", pageEnd: 3, pageStart: 3 },
    ]);
    const store = new DynamoDbChunkStore({ listChunks } as unknown as IDocumentRepository);

    await expect(store.similaritySearch({
      documentId: "document-1",
      embedding: [],
      queryText: "How does Lambda scale?",
      topK: 2,
      userId: "user-1",
    })).resolves.toMatchObject([
      { id: "three", similarity: 3 },
      { id: "one", similarity: 1 },
    ]);

    expect(listChunks).toHaveBeenCalledWith({ documentId: "document-1", userId: "user-1" });
  });

  it("rejects a query that has no searchable terms", async () => {
    const store = new DynamoDbChunkStore({ listChunks: vi.fn() } as unknown as IDocumentRepository);
    await expect(store.similaritySearch({ documentId: "document-1", embedding: [], queryText: " ", userId: "user-1" }))
      .rejects.toThrow("queryText is required");
  });
});
