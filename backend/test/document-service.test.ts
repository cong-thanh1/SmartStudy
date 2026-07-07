import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentConfig } from "../src/modules/documents/document-config.js";
import {
  DocumentNotFoundError,
  InvalidDocumentStateError,
  InvalidDocumentUploadError,
  UploadMetadataMismatchError,
  UploadNotFoundError,
} from "../src/modules/documents/document-errors.js";
import type {
  DocumentRecord,
  IDocumentRepository,
} from "../src/modules/documents/document-repository.js";
import { DocumentService } from "../src/modules/documents/document-service.js";
import {
  StorageObjectNotFoundError,
  type IQueueProvider,
  type IStorageProvider,
  type PresignedUpload,
} from "../src/ports/index.js";

const documentId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const fileKey = `users/${userId}/documents/${documentId}.pdf`;
const createdAt = new Date("2026-07-04T12:00:00.000Z");
const config: DocumentConfig = {
  chunkMaxTokens: 700,
  chunkOverlapTokens: 80,
  maxFileSizeBytes: 1_000,
  processingAttempts: 3,
  processingQueue: "document-processing",
  uploadUrlExpiresSeconds: 600,
};
const upload: PresignedUpload = {
  expiresAt: new Date("2026-07-04T12:10:00.000Z"),
  headers: {
    "content-length": "42",
    "content-type": "application/pdf",
  },
  method: "PUT",
  url: "https://storage.example.test/upload",
};

function createDocument(
  status: DocumentRecord["status"] = "uploading",
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
    createUploading: vi.fn(async (input) => ({
      ...createDocument(),
      ...input,
      createdAt,
      status: "uploading",
    })),
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
    download: vi.fn(async () => Readable.from([])),
    getDownloadUrl: vi.fn(async () => "https://storage.example.test/download"),
    getMetadata: vi.fn(async () => ({
      contentLength: 42,
      contentType: "application/pdf",
    })),
    getUploadUrl: vi.fn(async () => upload),
    upload: vi.fn(async () => undefined),
  };
}

function createQueueProvider(): IQueueProvider {
  return {
    consume: vi.fn(async () => ({
      close: vi.fn(async () => undefined),
    })),
    enqueue: vi.fn(async () => ({ jobId: documentId })),
  };
}

describe("DocumentService", () => {
  let queueProvider: IQueueProvider;
  let repository: IDocumentRepository;
  let storageProvider: IStorageProvider;
  let service: DocumentService;

  beforeEach(() => {
    queueProvider = createQueueProvider();
    repository = createRepository();
    storageProvider = createStorageProvider();
    service = new DocumentService(
      repository,
      storageProvider,
      queueProvider,
      config,
      { createId: () => documentId },
    );
  });

  it("creates a server-owned key and returns a presigned PDF upload", async () => {
    await expect(
      service.requestUpload({
        contentType: "application/pdf",
        sizeBytes: 42,
        title: " Study guide ",
        userId,
      }),
    ).resolves.toEqual({
      document: {
        createdAt,
        id: documentId,
        sizeBytes: 42,
        status: "uploading",
        title: "Study guide",
      },
      upload,
    });
    expect(storageProvider.getUploadUrl).toHaveBeenCalledWith({
      contentLength: 42,
      contentType: "application/pdf",
      expiresInSeconds: 600,
      key: fileKey,
    });
    expect(repository.createUploading).toHaveBeenCalledWith({
      fileKey,
      id: documentId,
      sizeBytes: 42,
      title: "Study guide",
      userId,
    });
  });

  it.each([
    {
      contentType: "text/plain",
      sizeBytes: 42,
      title: "Study guide",
      userId,
    },
    {
      contentType: "application/pdf",
      sizeBytes: 0,
      title: "Study guide",
      userId,
    },
    {
      contentType: "application/pdf",
      sizeBytes: 1_001,
      title: "Study guide",
      userId,
    },
    {
      contentType: "application/pdf",
      sizeBytes: 42,
      title: " ",
      userId,
    },
  ])("rejects invalid upload requests %#", async (input) => {
    await expect(service.requestUpload(input)).rejects.toThrow(
      InvalidDocumentUploadError,
    );
    expect(storageProvider.getUploadUrl).not.toHaveBeenCalled();
    expect(repository.createUploading).not.toHaveBeenCalled();
  });

  it("does not create a document if presigning fails", async () => {
    vi.mocked(storageProvider.getUploadUrl).mockRejectedValueOnce(
      new Error("storage unavailable"),
    );

    await expect(
      service.requestUpload({
        contentType: "application/pdf",
        sizeBytes: 42,
        title: "Study guide",
        userId,
      }),
    ).rejects.toThrow("storage unavailable");
    expect(repository.createUploading).not.toHaveBeenCalled();
  });

  it("verifies the upload, transitions it, and enqueues processing", async () => {
    await expect(service.completeUpload(documentId, userId)).resolves.toEqual({
      createdAt,
      id: documentId,
      sizeBytes: 42,
      status: "processing",
      title: "Study guide",
    });
    expect(storageProvider.getMetadata).toHaveBeenCalledWith(fileKey);
    expect(repository.markProcessing).toHaveBeenCalledWith(documentId, userId);
    expect(queueProvider.enqueue).toHaveBeenCalledWith(
      "document-processing",
      {
        documentId,
        fileKey,
        userId,
      },
      {
        attempts: 3,
        jobId: documentId,
      },
    );
  });

  it("maps a missing storage object to an upload conflict", async () => {
    vi.mocked(storageProvider.getMetadata).mockRejectedValueOnce(
      new StorageObjectNotFoundError(fileKey),
    );

    await expect(service.completeUpload(documentId, userId)).rejects.toThrow(
      UploadNotFoundError,
    );
    expect(repository.markProcessing).not.toHaveBeenCalled();
    expect(queueProvider.enqueue).not.toHaveBeenCalled();
  });

  it("preserves non-not-found storage metadata failures", async () => {
    const storageError = new Error("storage unavailable");
    vi.mocked(storageProvider.getMetadata).mockRejectedValueOnce(storageError);

    await expect(service.completeUpload(documentId, userId)).rejects.toBe(
      storageError,
    );
    expect(repository.markProcessing).not.toHaveBeenCalled();
  });

  it.each([
    { contentLength: 41, contentType: "application/pdf" },
    { contentLength: 42, contentType: "text/plain" },
    { contentType: "application/pdf" },
  ])("rejects uploaded object metadata mismatch %#", async (metadata) => {
    vi.mocked(storageProvider.getMetadata).mockResolvedValueOnce(metadata);

    await expect(service.completeUpload(documentId, userId)).rejects.toThrow(
      UploadMetadataMismatchError,
    );
    expect(repository.markProcessing).not.toHaveBeenCalled();
  });

  it("does not expose whether another user's document exists", async () => {
    vi.mocked(repository.findOwnedById).mockResolvedValueOnce(null);

    await expect(service.completeUpload(documentId, userId)).rejects.toThrow(
      DocumentNotFoundError,
    );
    expect(storageProvider.getMetadata).not.toHaveBeenCalled();
  });

  it("rejects completion from failed state", async () => {
    vi.mocked(repository.findOwnedById).mockResolvedValueOnce(
      createDocument("failed"),
    );

    await expect(service.completeUpload(documentId, userId)).rejects.toThrow(
      InvalidDocumentStateError,
    );
    expect(queueProvider.enqueue).not.toHaveBeenCalled();
  });

  it("heals a processing document by idempotently enqueueing it again", async () => {
    vi.mocked(repository.findOwnedById).mockResolvedValueOnce(
      createDocument("processing"),
    );

    await expect(service.completeUpload(documentId, userId)).resolves.toMatchObject(
      {
        status: "processing",
      },
    );
    expect(storageProvider.getMetadata).not.toHaveBeenCalled();
    expect(repository.markProcessing).not.toHaveBeenCalled();
    expect(queueProvider.enqueue).toHaveBeenCalledOnce();
  });

  it("returns ready documents without duplicate queue work", async () => {
    vi.mocked(repository.findOwnedById).mockResolvedValueOnce(
      createDocument("ready"),
    );

    await expect(service.completeUpload(documentId, userId)).resolves.toMatchObject(
      {
        status: "ready",
      },
    );
    expect(queueProvider.enqueue).not.toHaveBeenCalled();
  });

  it("handles a concurrent completion transition", async () => {
    vi.mocked(repository.markProcessing).mockResolvedValueOnce(false);
    vi.mocked(repository.findOwnedById)
      .mockResolvedValueOnce(createDocument("uploading"))
      .mockResolvedValueOnce(createDocument("processing"));

    await expect(service.completeUpload(documentId, userId)).resolves.toMatchObject(
      {
        status: "processing",
      },
    );
    expect(queueProvider.enqueue).toHaveBeenCalledOnce();
  });

  it("fails safely if a raced document disappears", async () => {
    vi.mocked(repository.markProcessing).mockResolvedValueOnce(false);
    vi.mocked(repository.findOwnedById)
      .mockResolvedValueOnce(createDocument("uploading"))
      .mockResolvedValueOnce(null);

    await expect(service.completeUpload(documentId, userId)).rejects.toThrow(
      DocumentNotFoundError,
    );
  });

  it("rejects an unresolved transition race", async () => {
    vi.mocked(repository.markProcessing).mockResolvedValueOnce(false);
    vi.mocked(repository.findOwnedById)
      .mockResolvedValueOnce(createDocument("uploading"))
      .mockResolvedValueOnce(createDocument("uploading"));

    await expect(service.completeUpload(documentId, userId)).rejects.toThrow(
      InvalidDocumentStateError,
    );
  });

  it("lists owned documents with trimmed search and pagination metadata", async () => {
    vi.mocked(repository.listOwned).mockResolvedValueOnce({
      documents: [
        {
          ...createDocument("ready"),
          chapters: [
            {
              chapterTitle: "Chapter 1",
              endPage: 3,
              startPage: 1,
            },
          ],
          pageCount: 3,
        },
      ],
      total: 21,
    });

    await expect(
      service.listDocuments({
        limit: 10,
        page: 2,
        search: " Study ",
        status: "ready",
        userId,
      }),
    ).resolves.toEqual({
      documents: [
        {
          createdAt,
          id: documentId,
          pageCount: 3,
          sizeBytes: 42,
          status: "ready",
          title: "Study guide",
        },
      ],
      pagination: {
        limit: 10,
        page: 2,
        total: 21,
        totalPages: 3,
      },
    });
    expect(repository.listOwned).toHaveBeenCalledWith({
      limit: 10,
      page: 2,
      search: "Study",
      status: "ready",
      userId,
    });
  });

  it("returns document detail without exposing storage internals", async () => {
    vi.mocked(repository.findOwnedById).mockResolvedValueOnce({
      ...createDocument("ready"),
      chapters: [
        {
          chapterTitle: "Chapter 1",
          endPage: 2,
          startPage: 1,
        },
      ],
      pageCount: 2,
    });

    await expect(service.getDocument(documentId, userId)).resolves.toEqual({
      chapters: [
        {
          chapterTitle: "Chapter 1",
          endPage: 2,
          startPage: 1,
        },
      ],
      createdAt,
      id: documentId,
      pageCount: 2,
      sizeBytes: 42,
      status: "ready",
      title: "Study guide",
    });
  });

  it("does not expose whether another user's detail exists", async () => {
    vi.mocked(repository.findOwnedById).mockResolvedValueOnce(null);

    await expect(service.getDocument(documentId, userId)).rejects.toThrow(
      DocumentNotFoundError,
    );
  });

  it("deletes storage before soft-deleting the owned document", async () => {
    await expect(
      service.deleteDocument(documentId, userId),
    ).resolves.toBeUndefined();
    expect(storageProvider.delete).toHaveBeenCalledWith(fileKey);
    expect(repository.softDeleteOwned).toHaveBeenCalledWith(documentId, userId);
    expect(
      vi.mocked(storageProvider.delete).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(repository.softDeleteOwned).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("soft-deletes when the storage object is already absent", async () => {
    vi.mocked(storageProvider.delete).mockRejectedValueOnce(
      new StorageObjectNotFoundError(fileKey),
    );

    await expect(
      service.deleteDocument(documentId, userId),
    ).resolves.toBeUndefined();
    expect(repository.softDeleteOwned).toHaveBeenCalledWith(documentId, userId);
  });

  it("does not soft-delete when storage deletion fails", async () => {
    const storageError = new Error("storage unavailable");
    vi.mocked(storageProvider.delete).mockRejectedValueOnce(storageError);

    await expect(service.deleteDocument(documentId, userId)).rejects.toBe(
      storageError,
    );
    expect(repository.softDeleteOwned).not.toHaveBeenCalled();
  });

  it("does not delete storage for an unowned document", async () => {
    vi.mocked(repository.findOwnedById).mockResolvedValueOnce(null);

    await expect(service.deleteDocument(documentId, userId)).rejects.toThrow(
      DocumentNotFoundError,
    );
    expect(storageProvider.delete).not.toHaveBeenCalled();
    expect(repository.softDeleteOwned).not.toHaveBeenCalled();
  });
});
