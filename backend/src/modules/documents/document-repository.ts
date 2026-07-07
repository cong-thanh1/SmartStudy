export type DocumentStatus =
  | "failed"
  | "processing"
  | "ready"
  | "uploading";

export interface DocumentChapter {
  readonly chapterTitle: string;
  readonly endPage: number;
  readonly startPage: number;
}

export interface DocumentChunkInput {
  readonly chapterTitle: string | null;
  readonly chunkText: string;
  readonly embedding: readonly number[];
  readonly pageEnd: number;
  readonly pageStart: number;
}

export interface DocumentChunkRecord {
  readonly chapterTitle: string | null;
  readonly chunkText: string;
  readonly id: string;
  readonly pageEnd: number | null;
  readonly pageStart: number | null;
}

export interface DocumentRecord {
  readonly chapters: readonly DocumentChapter[];
  readonly createdAt: Date;
  readonly fileKey: string;
  readonly id: string;
  readonly pageCount: number | null;
  readonly sizeBytes: number | null;
  readonly status: DocumentStatus;
  readonly title: string;
  readonly userId: string;
}

export interface CreateUploadingDocumentInput {
  readonly fileKey: string;
  readonly id: string;
  readonly sizeBytes: number;
  readonly title: string;
  readonly userId: string;
}

export interface CompleteDocumentProcessingInput {
  readonly chapters: readonly DocumentChapter[];
  readonly chunks: readonly DocumentChunkInput[];
  readonly documentId: string;
  readonly pageCount: number;
  readonly userId: string;
}

export interface ListOwnedDocumentsInput {
  readonly limit: number;
  readonly page: number;
  readonly search?: string;
  readonly status?: DocumentStatus;
  readonly userId: string;
}

export interface ListOwnedDocumentsResult {
  readonly documents: readonly DocumentRecord[];
  readonly total: number;
}

export interface ListDocumentChunksInput {
  readonly chapterTitle?: string;
  readonly documentId: string;
  readonly userId: string;
}

export interface IDocumentRepository {
  createUploading(
    input: CreateUploadingDocumentInput,
  ): Promise<DocumentRecord>;
  findOwnedById(
    documentId: string,
    userId: string,
  ): Promise<DocumentRecord | null>;
  listChunks(
    input: ListDocumentChunksInput,
  ): Promise<readonly DocumentChunkRecord[]>;
  listOwned(
    input: ListOwnedDocumentsInput,
  ): Promise<ListOwnedDocumentsResult>;
  markFailed(documentId: string, userId: string): Promise<boolean>;
  markProcessing(documentId: string, userId: string): Promise<boolean>;
  replaceChunksAndMarkReady(
    input: CompleteDocumentProcessingInput,
  ): Promise<boolean>;
  softDeleteOwned(documentId: string, userId: string): Promise<boolean>;
}
