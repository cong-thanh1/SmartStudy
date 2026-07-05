import { describe, expect, it, vi } from "vitest";

import { PgVectorStore } from "../src/adapters/vector/pg-vector-store.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { VectorRecord } from "../src/ports/index.js";

interface MockWithCalls {
  readonly mock: {
    readonly calls: readonly (readonly unknown[])[];
  };
}

function createPrismaStub() {
  return {
    $executeRaw: vi.fn(async (): Promise<number> => 1),
    $queryRaw: vi.fn(async (): Promise<unknown[]> => []),
  };
}

function createEmbedding(value = 0.1): number[] {
  return Array.from({ length: 1024 }, (_, index) => value + index / 1_000_000);
}

function firstCall(mock: MockWithCalls): readonly unknown[] {
  const call = mock.mock.calls[0];

  if (!call) {
    throw new Error("Expected mock to have been called");
  }

  return call;
}

function sqlFrom(call: readonly unknown[]): string {
  return (call[0] as TemplateStringsArray).join("?");
}

function valuesFrom(call: readonly unknown[]): readonly unknown[] {
  return call.slice(1);
}

function createVectorRecord(
  overrides: Partial<VectorRecord> = {},
): VectorRecord {
  return {
    documentId: "document-1",
    embedding: createEmbedding(),
    id: "chunk-1",
    text: "Chunk text",
    userId: "user-1",
    ...overrides,
  };
}

describe("PgVectorStore", () => {
  it("searches chunks only through the owned ready document", async () => {
    const prisma = createPrismaStub();
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        chapterTitle: "Chapter 1",
        documentId: "document-1",
        id: "chunk-1",
        pageEnd: 2,
        pageStart: 1,
        similarity: 0.91,
        text: "Chunk one",
      },
      {
        chapterTitle: null,
        documentId: "document-1",
        id: "chunk-2",
        pageEnd: null,
        pageStart: null,
        similarity: "0.82",
        text: "Chunk two",
      },
    ]);
    const store = new PgVectorStore(prisma as unknown as PrismaClient);

    await expect(
      store.similaritySearch({
        documentId: "document-1",
        embedding: createEmbedding(),
        topK: 3,
        userId: "user-1",
      }),
    ).resolves.toEqual([
      {
        chapterTitle: "Chapter 1",
        documentId: "document-1",
        id: "chunk-1",
        pageEnd: 2,
        pageStart: 1,
        similarity: 0.91,
        text: "Chunk one",
      },
      {
        documentId: "document-1",
        id: "chunk-2",
        similarity: 0.82,
        text: "Chunk two",
      },
    ]);

    const call = firstCall(prisma.$queryRaw);
    const sql = sqlFrom(call);
    const values = valuesFrom(call);
    expect(sql).toContain('JOIN "documents" AS d ON d."id" = c."document_id"');
    expect(sql).toContain('d."id" = ?::uuid');
    expect(sql).toContain('d."user_id" = ?::uuid');
    expect(sql).toContain('d."deleted" = false');
    expect(sql).toContain('d."status" = \'ready\'');
    expect(sql).toContain('c."embedding" IS NOT NULL');
    expect(sql).toContain('ORDER BY c."embedding" <=> q."embedding"');
    expect(sql).toContain("LIMIT ?");
    expect(values).toContain("document-1");
    expect(values).toContain("user-1");
    expect(values).toContain(3);
  });

  it("uses a default topK of five", async () => {
    const prisma = createPrismaStub();
    const store = new PgVectorStore(prisma as unknown as PrismaClient);

    await store.similaritySearch({
      documentId: "document-1",
      embedding: createEmbedding(),
      userId: "user-1",
    });

    expect(valuesFrom(firstCall(prisma.$queryRaw))).toContain(5);
  });

  it("upserts embeddings through an owned document guard", async () => {
    const prisma = createPrismaStub();
    const store = new PgVectorStore(prisma as unknown as PrismaClient);

    await store.upsertEmbeddings([
      createVectorRecord({
        chapterTitle: " Chapter 1 ",
        pageEnd: 2,
        pageStart: 1,
        text: " Chunk text ",
      }),
    ]);

    const call = firstCall(prisma.$executeRaw);
    const sql = sqlFrom(call);
    const values = valuesFrom(call);
    expect(sql).toContain('INSERT INTO "document_chunks"');
    expect(sql).toContain('FROM "documents" AS d');
    expect(sql).toContain('d."id" = ?::uuid');
    expect(sql).toContain('d."user_id" = ?::uuid');
    expect(sql).toContain('d."deleted" = false');
    expect(sql).toContain('ON CONFLICT ("id") DO UPDATE SET');
    expect(sql).toContain('WHERE EXISTS (');
    expect(sql).toContain('owner."user_id" = ?::uuid');
    expect(values[0]).toBe("chunk-1");
    expect(values[1]).toBe("Chunk text");
    expect(values[2]).toBe("Chapter 1");
    expect(values).toContain("document-1");
    expect(values).toContain("user-1");
  });

  it("skips empty upserts", async () => {
    const prisma = createPrismaStub();
    const store = new PgVectorStore(prisma as unknown as PrismaClient);

    await store.upsertEmbeddings([]);

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("deletes chunks only through an owned document guard", async () => {
    const prisma = createPrismaStub();
    const store = new PgVectorStore(prisma as unknown as PrismaClient);

    await store.deleteByDocument({
      documentId: "document-1",
      userId: "user-1",
    });

    const call = firstCall(prisma.$executeRaw);
    const sql = sqlFrom(call);
    const values = valuesFrom(call);
    expect(sql).toContain('DELETE FROM "document_chunks" AS c');
    expect(sql).toContain('USING "documents" AS d');
    expect(sql).toContain('c."document_id" = d."id"');
    expect(sql).toContain('d."id" = ?::uuid');
    expect(sql).toContain('d."user_id" = ?::uuid');
    expect(sql).toContain('d."deleted" = false');
    expect(values).toEqual(["document-1", "user-1"]);
  });

  it("rejects invalid vector search inputs before querying", async () => {
    const prisma = createPrismaStub();
    const store = new PgVectorStore(prisma as unknown as PrismaClient);

    await expect(
      store.similaritySearch({
        documentId: "document-1",
        embedding: [0.1],
        userId: "user-1",
      }),
    ).rejects.toThrow(RangeError);
    await expect(
      store.similaritySearch({
        documentId: "document-1",
        embedding: createEmbedding(),
        topK: 0,
        userId: "user-1",
      }),
    ).rejects.toThrow(RangeError);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects invalid vector records before upserting", async () => {
    const prisma = createPrismaStub();
    const store = new PgVectorStore(prisma as unknown as PrismaClient);

    await expect(
      store.upsertEmbeddings([createVectorRecord({ embedding: [0.1] })]),
    ).rejects.toThrow(RangeError);
    await expect(
      store.upsertEmbeddings([createVectorRecord({ text: "   " })]),
    ).rejects.toThrow(RangeError);
    await expect(
      store.upsertEmbeddings([
        createVectorRecord({ pageEnd: 1, pageStart: 2 }),
      ]),
    ).rejects.toThrow(RangeError);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});