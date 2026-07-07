import { describe, expect, it, vi } from "vitest";

import { PrismaSummaryRepository } from "../src/adapters/summary/prisma-summary-repository.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const createdAt = new Date("2026-07-07T01:00:00.000Z");
const documentId = "11111111-1111-4111-8111-111111111111";
const summaryId = "55555555-5555-4555-8555-555555555555";
const chapterRef = "Chapter 1";

interface DatabaseSummaryStub {
  readonly chapterRef: string | null;
  readonly createdAt: Date;
  readonly documentId: string;
  readonly id: string;
  readonly keyPoints: unknown;
  readonly scope: string;
  readonly summaryText: string;
}

const databaseSummary: DatabaseSummaryStub = {
  chapterRef: null,
  createdAt,
  documentId,
  id: summaryId,
  keyPoints: ["Key 1", "Key 2"],
  scope: "full",
  summaryText: "This is a full document summary.",
};

function createPrismaStub() {
  return {
    summary: {
      create: vi.fn(async () => databaseSummary),
      findFirst: vi.fn(
        async (): Promise<DatabaseSummaryStub | null> => databaseSummary,
      ),
      update: vi.fn(async () => ({
        ...databaseSummary,
        summaryText: "Updated summary text.",
      })),
    },
  };
}

describe("PrismaSummaryRepository", () => {
  it("finds a full-document cached summary", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaSummaryRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.findFullDocumentSummary(documentId),
    ).resolves.toEqual(databaseSummary);
    expect(prisma.summary.findFirst).toHaveBeenCalledWith({
      select: expect.any(Object),
      where: {
        chapterRef: null,
        documentId,
        scope: "full",
      },
    });
  });

  it("finds a chapter cached summary", async () => {
    const prisma = createPrismaStub();
    prisma.summary.findFirst.mockResolvedValueOnce({
      ...databaseSummary,
      chapterRef,
      scope: "chapter",
      summaryText: "Chapter summary.",
    });
    const repository = new PrismaSummaryRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.findChapterSummary({
        chapterRef,
        documentId,
      }),
    ).resolves.toMatchObject({
      chapterRef,
      scope: "chapter",
      summaryText: "Chapter summary.",
    });
    expect(prisma.summary.findFirst).toHaveBeenCalledWith({
      select: expect.any(Object),
      where: {
        chapterRef,
        documentId,
        scope: "chapter",
      },
    });
  });

  it("returns null when no cached summary exists", async () => {
    const prisma = createPrismaStub();
    prisma.summary.findFirst.mockResolvedValueOnce(null);
    const repository = new PrismaSummaryRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.findFullDocumentSummary(documentId),
    ).resolves.toBeNull();
  });

  it("creates a new full-document summary when no cache row exists", async () => {
    const prisma = createPrismaStub();
    prisma.summary.findFirst.mockResolvedValueOnce(null);
    const repository = new PrismaSummaryRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.saveFullDocumentSummary({
        documentId,
        keyPoints: [" Key 1 ", "Key 2"],
        summaryText: "This is a full document summary.",
      }),
    ).resolves.toEqual(databaseSummary);
    expect(prisma.summary.create).toHaveBeenCalledWith({
      data: {
        chapterRef: null,
        documentId,
        keyPoints: ["Key 1", "Key 2"],
        scope: "full",
        summaryText: "This is a full document summary.",
      },
      select: expect.any(Object),
    });
  });

  it("creates a new chapter summary when no cache row exists", async () => {
    const prisma = createPrismaStub();
    prisma.summary.findFirst.mockResolvedValueOnce(null);
    prisma.summary.create.mockResolvedValueOnce({
      ...databaseSummary,
      chapterRef,
      scope: "chapter",
      summaryText: "Chapter summary.",
    });
    const repository = new PrismaSummaryRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.saveChapterSummary({
        chapterRef,
        documentId,
        keyPoints: ["Chapter Key"],
        summaryText: "Chapter summary.",
      }),
    ).resolves.toMatchObject({
      chapterRef,
      scope: "chapter",
      summaryText: "Chapter summary.",
    });
    expect(prisma.summary.create).toHaveBeenCalledWith({
      data: {
        chapterRef,
        documentId,
        keyPoints: ["Chapter Key"],
        scope: "chapter",
        summaryText: "Chapter summary.",
      },
      select: expect.any(Object),
    });
  });

  it("updates an existing full-document summary on force refresh", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaSummaryRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.saveFullDocumentSummary({
        documentId,
        keyPoints: ["Key 1", "Key 2"],
        summaryText: "Updated summary text.",
      }),
    ).resolves.toMatchObject({
      summaryText: "Updated summary text.",
    });
    expect(prisma.summary.update).toHaveBeenCalledWith({
      data: {
        keyPoints: ["Key 1", "Key 2"],
        summaryText: "Updated summary text.",
      },
      select: expect.any(Object),
      where: {
        id: summaryId,
      },
    });
  });

  it("rejects corrupt summary cache rows", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaSummaryRepository(
      prisma as unknown as PrismaClient,
    );

    prisma.summary.findFirst.mockResolvedValueOnce({
      ...databaseSummary,
      chapterRef: "Chapter 1",
      scope: "chapter",
    });
    await expect(
      repository.findFullDocumentSummary(documentId),
    ).resolves.toMatchObject({
      chapterRef: "Chapter 1",
      scope: "chapter",
    });

    prisma.summary.findFirst.mockResolvedValueOnce({
      ...databaseSummary,
      chapterRef: null,
      scope: "chapter",
    });
    await expect(
      repository.findFullDocumentSummary(documentId),
    ).rejects.toThrow("Chapter summary cache row must have chapterRef");

    prisma.summary.findFirst.mockResolvedValueOnce({
      ...databaseSummary,
      keyPoints: ["Valid", 42],
    });
    await expect(
      repository.findFullDocumentSummary(documentId),
    ).rejects.toThrow("Summary key point 1");
  });
});
