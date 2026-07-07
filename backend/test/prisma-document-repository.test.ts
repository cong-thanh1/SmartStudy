import { describe, expect, it, vi } from "vitest";

import { PrismaDocumentRepository } from "../src/adapters/documents/prisma-document-repository.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const createdAt = new Date("2026-07-04T12:00:00.000Z");
interface DatabaseStubDocument {
  readonly chapters: unknown;
  readonly createdAt: Date;
  readonly fileKey: string;
  readonly id: string;
  readonly pageCount: number | null;
  readonly sizeBytes: bigint | null;
  readonly status: string;
  readonly title: string;
  readonly userId: string;
}

const databaseDocument: DatabaseStubDocument = {
  chapters: [],
  createdAt,
  fileKey: "users/user-1/documents/document-1.pdf",
  id: "document-1",
  pageCount: null,
  sizeBytes: 42n,
  status: "uploading",
  title: "Study guide",
  userId: "user-1",
};

const databaseChunk = {
  chapterTitle: "Chapter 1",
  chunkText: "first chunk",
  id: "chunk-1",
  pageEnd: 2,
  pageStart: 1,
};

function createPrismaStub() {
  const transaction = {
    $executeRaw: vi.fn(async () => 1),
    document: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    documentChunk: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  };

  return {
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
    __transaction: transaction,
    document: {
      count: vi.fn(async () => 1),
      create: vi.fn(async (): Promise<DatabaseStubDocument> => databaseDocument),
      findMany: vi.fn(
        async (): Promise<DatabaseStubDocument[]> => [databaseDocument],
      ),
      findFirst: vi.fn(
        async (): Promise<DatabaseStubDocument | null> => databaseDocument,
      ),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    documentChunk: {
      findMany: vi.fn(async () => [databaseChunk]),
    },
  };
}

describe("PrismaDocumentRepository", () => {
  it("creates and maps uploading documents", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.createUploading({
        fileKey: databaseDocument.fileKey,
        id: databaseDocument.id,
        sizeBytes: 42,
        title: databaseDocument.title,
        userId: databaseDocument.userId,
      }),
    ).resolves.toEqual({
      ...databaseDocument,
      sizeBytes: 42,
    });
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        fileKey: databaseDocument.fileKey,
        id: databaseDocument.id,
        sizeBytes: 42n,
        status: "uploading",
        title: databaseDocument.title,
        userId: databaseDocument.userId,
      },
      select: expect.any(Object),
    });
  });

  it("finds only active documents owned by the user", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.findOwnedById("document-1", "user-1"),
    ).resolves.toMatchObject({
      id: "document-1",
      sizeBytes: 42,
      status: "uploading",
    });
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      select: expect.any(Object),
      where: {
        deleted: false,
        id: "document-1",
        userId: "user-1",
      },
    });

    prisma.document.findFirst.mockResolvedValueOnce(null);
    await expect(
      repository.findOwnedById("missing", "user-1"),
    ).resolves.toBeNull();
  });

  it("lists chunks only after verifying document ownership", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.listChunks({
        documentId: "document-1",
        userId: "user-1",
      }),
    ).resolves.toEqual([databaseChunk]);
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
      },
      where: {
        deleted: false,
        id: "document-1",
        userId: "user-1",
      },
    });
    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      orderBy: [
        {
          pageStart: "asc",
        },
        {
          pageEnd: "asc",
        },
        {
          id: "asc",
        },
      ],
      select: {
        chapterTitle: true,
        chunkText: true,
        id: true,
        pageEnd: true,
        pageStart: true,
      },
      where: {
        documentId: "document-1",
      },
    });
  });

  it("does not query chunks for another user's document", async () => {
    const prisma = createPrismaStub();
    prisma.document.findFirst.mockResolvedValueOnce(null);
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.listChunks({
        documentId: "document-1",
        userId: "other-user",
      }),
    ).resolves.toEqual([]);
    expect(prisma.documentChunk.findMany).not.toHaveBeenCalled();
  });

  it("can filter chunks by chapter title for later chapter summaries", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await repository.listChunks({
      chapterTitle: "Chapter 1",
      documentId: "document-1",
      userId: "user-1",
    });

    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chapterTitle: "Chapter 1",
          documentId: "document-1",
        },
      }),
    );
  });

  it("lists only owned active documents with case-insensitive search", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.listOwned({
        limit: 10,
        page: 2,
        search: "guide",
        status: "ready",
        userId: "user-1",
      }),
    ).resolves.toEqual({
      documents: [
        {
          ...databaseDocument,
          sizeBytes: 42,
        },
      ],
      total: 1,
    });
    expect(prisma.document.findMany).toHaveBeenCalledWith({
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: expect.any(Object),
      skip: 10,
      take: 10,
      where: {
        deleted: false,
        status: "ready",
        title: {
          contains: "guide",
          mode: "insensitive",
        },
        userId: "user-1",
      },
    });
    expect(prisma.document.count).toHaveBeenCalledWith({
      where: {
        deleted: false,
        status: "ready",
        title: {
          contains: "guide",
          mode: "insensitive",
        },
        userId: "user-1",
      },
    });
  });

  it("atomically transitions only owned uploading documents", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.markProcessing("document-1", "user-1"),
    ).resolves.toBe(true);
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      data: {
        status: "processing",
      },
      where: {
        deleted: false,
        id: "document-1",
        status: "uploading",
        userId: "user-1",
      },
    });

    prisma.document.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      repository.markProcessing("document-1", "user-1"),
    ).resolves.toBe(false);
  });

  it("atomically marks processing documents as failed", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.markFailed("document-1", "user-1"),
    ).resolves.toBe(true);
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      data: {
        status: "failed",
      },
      where: {
        deleted: false,
        id: "document-1",
        status: "processing",
        userId: "user-1",
      },
    });

    prisma.document.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      repository.markFailed("document-1", "user-1"),
    ).resolves.toBe(false);
  });

  it("soft-deletes only active documents owned by the user", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.softDeleteOwned("document-1", "user-1"),
    ).resolves.toBe(true);
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      data: {
        deleted: true,
      },
      where: {
        deleted: false,
        id: "document-1",
        userId: "user-1",
      },
    });

    prisma.document.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      repository.softDeleteOwned("document-1", "user-1"),
    ).resolves.toBe(false);
  });

  it("replaces chunks and marks a processing document ready in one transaction", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.replaceChunksAndMarkReady({
        chapters: [
          {
            chapterTitle: "Chapter 1 Basics",
            endPage: 2,
            startPage: 1,
          },
        ],
        chunks: [
          {
            chapterTitle: "Chapter 1 Basics",
            chunkText: "first chunk",
            embedding: createEmbedding(0.1),
            pageEnd: 1,
            pageStart: 1,
          },
          {
            chapterTitle: null,
            chunkText: "second chunk",
            embedding: createEmbedding(0.2),
            pageEnd: 2,
            pageStart: 2,
          },
        ],
        documentId: "document-1",
        pageCount: 2,
        userId: "user-1",
      }),
    ).resolves.toBe(true);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.__transaction.document.updateMany).toHaveBeenCalledWith({
      data: {
        chapters: [
          {
            chapter_title: "Chapter 1 Basics",
            end_page: 2,
            start_page: 1,
          },
        ],
        pageCount: 2,
        status: "ready",
      },
      where: {
        deleted: false,
        id: "document-1",
        status: "processing",
        userId: "user-1",
      },
    });
    expect(prisma.__transaction.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: {
        documentId: "document-1",
      },
    });
    expect(prisma.__transaction.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("does not replace chunks if the document is no longer processing", async () => {
    const prisma = createPrismaStub();
    prisma.__transaction.document.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.replaceChunksAndMarkReady({
        chapters: [],
        chunks: [
          {
            chapterTitle: null,
            chunkText: "chunk",
            embedding: createEmbedding(0.1),
            pageEnd: 1,
            pageStart: 1,
          },
        ],
        documentId: "document-1",
        pageCount: 1,
        userId: "user-1",
      }),
    ).resolves.toBe(false);
    expect(prisma.__transaction.documentChunk.deleteMany).not.toHaveBeenCalled();
    expect(prisma.__transaction.$executeRaw).not.toHaveBeenCalled();
  });

  it("rejects invalid vector dimensions before inserting chunks", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.replaceChunksAndMarkReady({
        chapters: [],
        chunks: [
          {
            chapterTitle: null,
            chunkText: "chunk",
            embedding: [0.1],
            pageEnd: 1,
            pageStart: 1,
          },
        ],
        documentId: "document-1",
        pageCount: 1,
        userId: "user-1",
      }),
    ).rejects.toThrow(RangeError);
  });

  it("rejects corrupt status and unsafe size values from the database", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    prisma.document.findFirst.mockResolvedValueOnce({
      ...databaseDocument,
      status: "unknown",
    });
    await expect(
      repository.findOwnedById("document-1", "user-1"),
    ).rejects.toThrow("Unsupported document status");

    prisma.document.findFirst.mockResolvedValueOnce({
      ...databaseDocument,
      sizeBytes: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
    });
    await expect(
      repository.findOwnedById("document-1", "user-1"),
    ).rejects.toThrow(RangeError);
  });

  it("maps nullable size metadata", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );
    prisma.document.findFirst.mockResolvedValueOnce({
      ...databaseDocument,
      sizeBytes: null,
    });

    await expect(
      repository.findOwnedById("document-1", "user-1"),
    ).resolves.toMatchObject({
      sizeBytes: null,
    });
  });
});

function createEmbedding(value: number): readonly number[] {
  return Array.from({ length: 1024 }, () => value);
}
