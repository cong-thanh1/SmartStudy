import { randomUUID } from "node:crypto";

import {
  StorageObjectNotFoundError,
  type IQueueProvider,
  type IStorageProvider,
  type PresignedUpload,
} from "../../ports/index.js";
import { PDF_CONTENT_TYPE, type DocumentConfig } from "./document-config.js";
import {
  DocumentNotFoundError,
  InvalidDocumentStateError,
  InvalidDocumentUploadError,
  UploadMetadataMismatchError,
  UploadNotFoundError,
} from "./document-errors.js";
import type {
  DocumentChapter,
  DocumentRecord,
  DocumentStatus,
  IDocumentRepository,
} from "./document-repository.js";

export interface RequestDocumentUploadInput {
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly title: string;
  readonly userId: string;
}

export interface DocumentSummary {
  readonly createdAt: Date;
  readonly id: string;
  readonly sizeBytes: number | null;
  readonly status: DocumentStatus;
  readonly title: string;
}

export interface DocumentDetail extends DocumentSummary {
  readonly chapters: readonly DocumentChapter[];
  readonly pageCount: number | null;
}

export interface DocumentListItem extends DocumentSummary {
  readonly pageCount: number | null;
}

export interface DocumentPreviewChunk {
  readonly chapterTitle: string | null;
  readonly pageEnd: number | null;
  readonly pageStart: number | null;
  readonly text: string;
}

export interface DocumentPreview extends DocumentDetail {
  readonly chunks: readonly DocumentPreviewChunk[];
}

export interface ListDocumentsInput {
  readonly limit: number;
  readonly page: number;
  readonly search?: string;
  readonly status?: DocumentStatus;
  readonly userId: string;
}

export interface ListDocumentsResult {
  readonly documents: readonly DocumentListItem[];
  readonly pagination: {
    readonly limit: number;
    readonly page: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface DocumentUploadResult {
  readonly document: DocumentSummary;
  readonly upload: PresignedUpload;
}

export interface ProcessDocumentJob {
  readonly documentId: string;
  readonly fileKey: string;
  readonly userId: string;
}

export interface IDocumentService {
  completeUpload(
    documentId: string,
    userId: string,
  ): Promise<DocumentSummary>;
  deleteDocument(documentId: string, userId: string): Promise<void>;
  getDocument(documentId: string, userId: string): Promise<DocumentDetail>;
  getDocumentPreview(documentId: string, userId: string): Promise<DocumentPreview>;
  listDocuments(input: ListDocumentsInput): Promise<ListDocumentsResult>;
  requestUpload(
    input: RequestDocumentUploadInput,
  ): Promise<DocumentUploadResult>;
}

export interface DocumentServiceDependencies {
  readonly createId?: () => string;
}

export class DocumentService implements IDocumentService {
  private readonly createId: () => string;

  constructor(
    private readonly repository: IDocumentRepository,
    private readonly storageProvider: IStorageProvider,
    private readonly queueProvider: IQueueProvider,
    private readonly config: DocumentConfig,
    dependencies: DocumentServiceDependencies = {},
  ) {
    this.createId = dependencies.createId ?? randomUUID;
  }

  async requestUpload(
    input: RequestDocumentUploadInput,
  ): Promise<DocumentUploadResult> {
    const title = validateUploadRequest(input, this.config);
    const documentId = this.createId();
    const fileKey = createDocumentFileKey(input.userId, documentId);
    const upload = await this.storageProvider.getUploadUrl({
      contentLength: input.sizeBytes,
      contentType: PDF_CONTENT_TYPE,
      expiresInSeconds: this.config.uploadUrlExpiresSeconds,
      key: fileKey,
    });
    const document = await this.repository.createUploading({
      fileKey,
      id: documentId,
      sizeBytes: input.sizeBytes,
      title,
      userId: input.userId,
    });

    return {
      document: toDocumentSummary(document),
      upload,
    };
  }

  async completeUpload(
    documentId: string,
    userId: string,
  ): Promise<DocumentSummary> {
    let document = await this.repository.findOwnedById(documentId, userId);

    if (!document) {
      throw new DocumentNotFoundError();
    }

    if (document.status === "uploading") {
      await this.verifyUploadedObject(document);
      const transitioned = await this.repository.markProcessing(
        document.id,
        userId,
      );

      if (transitioned) {
        document = {
          ...document,
          status: "processing",
        };
      } else {
        const current = await this.repository.findOwnedById(documentId, userId);

        if (!current) {
          throw new DocumentNotFoundError();
        }

        document = current;
      }
    }

    if (document.status === "ready") {
      return toDocumentSummary(document);
    }

    if (document.status !== "processing") {
      throw new InvalidDocumentStateError(document.status);
    }

    await this.queueProvider.enqueue<ProcessDocumentJob>(
      this.config.processingQueue,
      {
        documentId: document.id,
        fileKey: document.fileKey,
        userId,
      },
      {
        attempts: this.config.processingAttempts,
        jobId: document.id,
      },
    );

    return toDocumentSummary(document);
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await this.repository.findOwnedById(documentId, userId);

    if (!document) {
      throw new DocumentNotFoundError();
    }

    try {
      await this.storageProvider.delete(document.fileKey);
    } catch (error) {
      if (!(error instanceof StorageObjectNotFoundError)) {
        throw error;
      }
    }

    await this.repository.softDeleteOwned(documentId, userId);
  }

  async getDocument(
    documentId: string,
    userId: string,
  ): Promise<DocumentDetail> {
    const document = await this.repository.findOwnedById(documentId, userId);

    if (!document) {
      throw new DocumentNotFoundError();
    }

    return toDocumentDetail(document);
  }

  async getDocumentPreview(
    documentId: string,
    userId: string,
  ): Promise<DocumentPreview> {
    const document = await this.repository.findOwnedById(documentId, userId);
    if (!document) throw new DocumentNotFoundError();

    const chunks = await this.repository.listChunks({ documentId, userId });
    return {
      ...toDocumentDetail(document),
      // The reader needs enough source text to make document switching clear,
      // while keeping the response bounded for large PDFs.
      chunks: chunks.slice(0, 20).map((chunk) => ({
        chapterTitle: chunk.chapterTitle,
        pageEnd: chunk.pageEnd,
        pageStart: chunk.pageStart,
        text: chunk.chunkText,
      })),
    };
  }

  async listDocuments(
    input: ListDocumentsInput,
  ): Promise<ListDocumentsResult> {
    const search = input.search?.trim();
    const result = await this.repository.listOwned({
      limit: input.limit,
      page: input.page,
      userId: input.userId,
      ...(search ? { search } : {}),
      ...(input.status ? { status: input.status } : {}),
    });

    return {
      documents: result.documents.map(toDocumentListItem),
      pagination: {
        limit: input.limit,
        page: input.page,
        total: result.total,
        totalPages:
          result.total === 0 ? 0 : Math.ceil(result.total / input.limit),
      },
    };
  }

  private async verifyUploadedObject(document: DocumentRecord): Promise<void> {
    let metadata;

    try {
      metadata = await this.storageProvider.getMetadata(document.fileKey);
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) {
        throw new UploadNotFoundError();
      }

      throw error;
    }

    if (
      metadata.contentType !== PDF_CONTENT_TYPE ||
      metadata.contentLength !== document.sizeBytes
    ) {
      console.error("METADATA MISMATCH:", {
        metadataContentType: metadata.contentType,
        expectedContentType: PDF_CONTENT_TYPE,
        metadataContentLength: metadata.contentLength,
        expectedContentLength: document.sizeBytes
      });
      throw new UploadMetadataMismatchError();
    }
  }
}

function validateUploadRequest(
  input: RequestDocumentUploadInput,
  config: DocumentConfig,
): string {
  const title = input.title.trim();

  if (title.length === 0 || title.length > 500) {
    throw new InvalidDocumentUploadError(
      "Document title must contain between 1 and 500 characters",
    );
  }

  if (input.contentType !== PDF_CONTENT_TYPE) {
    throw new InvalidDocumentUploadError("Only application/pdf is supported");
  }

  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > config.maxFileSizeBytes
  ) {
    throw new InvalidDocumentUploadError(
      `Document size must be between 1 and ${config.maxFileSizeBytes} bytes`,
    );
  }

  return title;
}

function createDocumentFileKey(userId: string, documentId: string): string {
  return `users/${userId}/documents/${documentId}.pdf`;
}

function toDocumentSummary(document: DocumentRecord): DocumentSummary {
  return {
    createdAt: document.createdAt,
    id: document.id,
    sizeBytes: document.sizeBytes,
    status: document.status,
    title: document.title,
  };
}

function toDocumentDetail(document: DocumentRecord): DocumentDetail {
  return {
    ...toDocumentSummary(document),
    chapters: document.chapters,
    pageCount: document.pageCount,
  };
}

function toDocumentListItem(document: DocumentRecord): DocumentListItem {
  return {
    ...toDocumentSummary(document),
    pageCount: document.pageCount,
  };
}
