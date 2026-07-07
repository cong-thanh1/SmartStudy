import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentConfig } from "../src/modules/documents/document-config.js";
import { DocumentProcessingService } from "../src/modules/documents/document-processing-service.js";
import type {
  DocumentRecord,
  IDocumentRepository,
} from "../src/modules/documents/document-repository.js";
import type {
  ExtractedPdfDocument,
  IPdfTextExtractor,
} from "../src/modules/documents/pdf-processing.js";
import {
  StorageObjectNotFoundError,
  type IEmbeddingProvider,
  type IStorageProvider,
  type QueueJob,
} from "../src/ports/index.js";

const documentId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const fileKey = `users/${userId}/documents/${documentId}.pdf`;
const createdAt = new Date("2026-07-05T00:00:00.000Z");
const config: DocumentConfig = {
  chunkMaxTokens: 5,
  chunkOverlapTokens: 1,
  maxFileSizeBytes: 1_000,
  processingAttempts: 3,
  processingQueue: "document-processing",
  uploadUrlExpiresSeconds: 900,
};
const extractedPdf: ExtractedPdfDocument = {
  pageCount: 2,
  pages: [
    {
      pageNumber: 1,
      text: "Chapter 1 Basics\nalpha beta gamma delta epsilon zeta",
    },
    {
      pageNumber: 2,
      text: "Chapter 2 Advanced\neta theta iota kappa",
    },
  ],
};

function createDocument(
  status: DocumentRecord["status"] = "processing",
): DocumentRecord {
  return {
    chapters: [],
    createdAt,
    fileKey,
    id: documentId,
    pageCount: null,
    sizeBytes: 42,
    status,
    title: "Study guide",
    userId,
  };
}

function createRepository(): IDocumentRepository {
  return {
    createUploading: vi.fn(async () => createDocument("uploading")),
    findOwnedById: vi.fn(async () => createDocument()),
    listChunks: vi.fn(async () => []),
    listOwned: vi.fn(async () => ({
      documents: [createDocument()],
      total: 1,
    })),
    markFailed: vi.fn(async () => true),
    markProcessing: vi.fn(async () => true),
    replaceChunksAndMarkReady: vi.fn(async () => true),
    softDeleteOwned: vi.fn(async () => true),
  };
}

function createStorageProvider(): IStorageProvider {
  return {
    delete: vi.fn(async () => undefined),
    download: vi.fn(async () => Readable.from([Buffer.from("%PDF")])),
    getDownloadUrl: vi.fn(async () => "https://storage.example.test/download"),
    getMetadata: vi.fn(async () => ({
      contentLength: 42,
      contentType: "application/pdf",
    })),
    getUploadUrl: vi.fn(async () => ({
      expiresAt: new Date("2026-07-05T00:10:00.000Z"),
      headers: {},
      method: "PUT" as const,
      url: "https://storage.example.test/upload",
    })),
    upload: vi.fn(async () => undefined),
  };
}

function createEmbeddingProvider(): IEmbeddingProvider {
  return {
    dimensions: 1024,
    embed: vi.fn(async () => createEmbedding(1)),
    embedBatch: vi.fn(async (texts: readonly string[]) =>
      texts.map((_, index) => createEmbedding(index + 1)),
    ),
  };
}

function createExtractor(): IPdfTextExtractor {
  return {
    extract: vi.fn(async () => extractedPdf),
  };
}

function createQueueJob(
  attemptsMade = 0,
  data: unknown = {
    documentId,
    fileKey,
    userId,
  },
): QueueJob<unknown> {
  return {
    attemptsMade,
    data,
    id: documentId,
    name: "document-processing",
  };
}

describe("DocumentProcessingService", () => {
  let embeddingProvider: IEmbeddingProvider;
  let extractor: IPdfTextExtractor;
  let repository: IDocumentRepository;
  let service: DocumentProcessingService;
  let storageProvider: IStorageProvider;

  beforeEach(() => {
    embeddingProvider = createEmbeddingProvider();
    extractor = createExtractor();
    repository = createRepository();
    storageProvider = createStorageProvider();
    service = new DocumentProcessingService(
      repository,
      storageProvider,
      embeddingProvider,
      extractor,
      config,
    );
  });

  it("downloads, extracts, chunks, embeds, and marks the document ready", async () => {
    await expect(service.processJob(createQueueJob())).resolves.toBeUndefined();

    expect(storageProvider.download).toHaveBeenCalledWith(fileKey);
    expect(extractor.extract).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(embeddingProvider.embedBatch).toHaveBeenCalledOnce();
    expect(repository.replaceChunksAndMarkReady).toHaveBeenCalledOnce();

    const saved =
      vi.mocked(repository.replaceChunksAndMarkReady).mock.calls[0]?.[0];

    expect(saved).toMatchObject({
      documentId,
      pageCount: 2,
      userId,
    });
    expect(saved?.chapters).toEqual([
      {
        chapterTitle: "Chapter 1 Basics",
        endPage: 1,
        startPage: 1,
      },
      {
        chapterTitle: "Chapter 2 Advanced",
        endPage: 2,
        startPage: 2,
      },
    ]);
    expect(saved?.chunks).toHaveLength(4);
    expect(saved?.chunks[0]).toMatchObject({
      chapterTitle: "Chapter 1 Basics",
      pageEnd: 1,
      pageStart: 1,
    });
    expect(saved?.chunks[0]?.embedding).toHaveLength(1024);
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("treats ready documents as idempotently complete", async () => {
    vi.mocked(repository.findOwnedById).mockResolvedValueOnce(
      createDocument("ready"),
    );

    await expect(service.processJob(createQueueJob())).resolves.toBeUndefined();
    expect(storageProvider.download).not.toHaveBeenCalled();
    expect(repository.replaceChunksAndMarkReady).not.toHaveBeenCalled();
  });

  it("marks empty text PDFs failed without retrying", async () => {
    vi.mocked(extractor.extract).mockResolvedValueOnce({
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          text: "   ",
        },
      ],
    });

    await expect(service.processJob(createQueueJob())).resolves.toBeUndefined();
    expect(repository.markFailed).toHaveBeenCalledWith(documentId, userId);
    expect(embeddingProvider.embedBatch).not.toHaveBeenCalled();
    expect(repository.replaceChunksAndMarkReady).not.toHaveBeenCalled();
  });

  it("does not mark transient embedding failures failed before the final attempt", async () => {
    vi.mocked(embeddingProvider.embedBatch).mockRejectedValueOnce(
      new Error("model unavailable"),
    );

    await expect(service.processJob(createQueueJob(0))).rejects.toThrow(
      "model unavailable",
    );
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("marks transient failures failed on the final configured attempt", async () => {
    vi.mocked(embeddingProvider.embedBatch).mockRejectedValueOnce(
      new Error("model unavailable"),
    );

    await expect(service.processJob(createQueueJob(2))).rejects.toThrow(
      "model unavailable",
    );
    expect(repository.markFailed).toHaveBeenCalledWith(documentId, userId);
  });

  it("marks missing storage objects failed without retrying", async () => {
    vi.mocked(storageProvider.download).mockRejectedValueOnce(
      new StorageObjectNotFoundError(fileKey),
    );

    await expect(service.processJob(createQueueJob())).resolves.toBeUndefined();
    expect(repository.markFailed).toHaveBeenCalledWith(documentId, userId);
  });

  it("rejects stale jobs whose file key no longer matches the document", async () => {
    await expect(
      service.processJob(
        createQueueJob(0, {
          documentId,
          fileKey: "users/other/document.pdf",
          userId,
        }),
      ),
    ).resolves.toBeUndefined();
    expect(repository.markFailed).toHaveBeenCalledWith(documentId, userId);
    expect(storageProvider.download).not.toHaveBeenCalled();
  });

  it("ignores invalid job payloads", async () => {
    await expect(
      service.processJob(createQueueJob(0, { nope: true })),
    ).resolves.toBeUndefined();
    expect(repository.findOwnedById).not.toHaveBeenCalled();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });
});

function createEmbedding(value: number): number[] {
  return Array.from({ length: 1024 }, () => value);
}
