import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { toPgVectorLiteral } from "../vector/pg-vector-utils.js";
import type {
  CompleteDocumentProcessingInput,
  CreateUploadingDocumentInput,
  DocumentChapter,
  DocumentChunkRecord,
  DocumentRecord,
  DocumentStatus,
  IDocumentRepository,
  ListDocumentChunksInput,
  ListOwnedDocumentsInput,
  ListOwnedDocumentsResult,
} from "../../modules/documents/document-repository.js";

const documentSelection = {
  chapters: true,
  createdAt: true,
  fileKey: true,
  id: true,
  pageCount: true,
  sizeBytes: true,
  status: true,
  title: true,
  userId: true,
} as const;

export class PrismaDocumentRepository implements IDocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createUploading(
    input: CreateUploadingDocumentInput,
  ): Promise<DocumentRecord> {
    const document = await this.prisma.document.create({
      data: {
        fileKey: input.fileKey,
        id: input.id,
        sizeBytes: BigInt(input.sizeBytes),
        status: "uploading",
        title: input.title,
        userId: input.userId,
      },
      select: documentSelection,
    });

    return mapDocument(document);
  }

  async findOwnedById(
    documentId: string,
    userId: string,
  ): Promise<DocumentRecord | null> {
    const document = await this.prisma.document.findFirst({
      select: documentSelection,
      where: {
        deleted: false,
        id: documentId,
        userId,
      },
    });

    return document ? mapDocument(document) : null;
  }

  async listChunks(
    input: ListDocumentChunksInput,
  ): Promise<readonly DocumentChunkRecord[]> {
    const owner = await this.prisma.document.findFirst({
      select: {
        id: true,
      },
      where: {
        deleted: false,
        id: input.documentId,
        userId: input.userId,
      },
    });

    if (!owner) {
      return [];
    }

    const chunks = await this.prisma.documentChunk.findMany({
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
        documentId: input.documentId,
        ...(input.chapterTitle === undefined
          ? {}
          : { chapterTitle: input.chapterTitle }),
      },
    });

    return chunks.map((chunk) => ({
      chapterTitle: chunk.chapterTitle,
      chunkText: chunk.chunkText,
      id: chunk.id,
      pageEnd: chunk.pageEnd,
      pageStart: chunk.pageStart,
    }));
  }

  async listOwned(
    input: ListOwnedDocumentsInput,
  ): Promise<ListOwnedDocumentsResult> {
    const where: Prisma.DocumentWhereInput = {
      deleted: false,
      userId: input.userId,
      ...(input.search
        ? {
            title: {
              contains: input.search,
              mode: "insensitive",
            },
          }
        : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        select: documentSelection,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        where,
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      documents: documents.map(mapDocument),
      total,
    };
  }

  async markFailed(documentId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.document.updateMany({
      data: {
        status: "failed",
      },
      where: {
        deleted: false,
        id: documentId,
        status: "processing",
        userId,
      },
    });

    return result.count === 1;
  }

  async markProcessing(
    documentId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.prisma.document.updateMany({
      data: {
        status: "processing",
      },
      where: {
        deleted: false,
        id: documentId,
        status: "uploading",
        userId,
      },
    });

    return result.count === 1;
  }

  async replaceChunksAndMarkReady(
    input: CompleteDocumentProcessingInput,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.document.updateMany({
        data: {
          chapters: toChapterJson(input.chapters),
          pageCount: input.pageCount,
          status: "ready",
        },
        where: {
          deleted: false,
          id: input.documentId,
          status: "processing",
          userId: input.userId,
        },
      });

      if (result.count !== 1) {
        return false;
      }

      await transaction.documentChunk.deleteMany({
        where: {
          documentId: input.documentId,
        },
      });

      for (const chunk of input.chunks) {
        await transaction.$executeRaw`
          INSERT INTO "document_chunks" (
            "document_id",
            "chunk_text",
            "chapter_title",
            "page_start",
            "page_end",
            "embedding"
          )
          VALUES (
            ${input.documentId}::uuid,
            ${chunk.chunkText},
            ${chunk.chapterTitle},
            ${chunk.pageStart},
            ${chunk.pageEnd},
            ${toPgVectorLiteral(chunk.embedding)}::vector
          )
        `;
      }

      return true;
    });
  }

  async softDeleteOwned(
    documentId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.prisma.document.updateMany({
      data: {
        deleted: true,
      },
      where: {
        deleted: false,
        id: documentId,
        userId,
      },
    });

    return result.count === 1;
  }
}

interface DatabaseDocument {
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

function mapDocument(document: DatabaseDocument): DocumentRecord {
  return {
    chapters: parseChapters(document.chapters),
    createdAt: document.createdAt,
    fileKey: document.fileKey,
    id: document.id,
    pageCount: document.pageCount,
    sizeBytes:
      document.sizeBytes === null
        ? null
        : parseSafeSizeBytes(document.sizeBytes),
    status: parseDocumentStatus(document.status),
    title: document.title,
    userId: document.userId,
  };
}

function parseDocumentStatus(status: string): DocumentStatus {
  if (
    status === "uploading" ||
    status === "processing" ||
    status === "ready" ||
    status === "failed"
  ) {
    return status;
  }

  throw new Error(`Unsupported document status stored in database: ${status}`);
}

function parseSafeSizeBytes(sizeBytes: bigint): number {
  const value = Number(sizeBytes);

  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Document size stored in database is not a safe integer");
  }

  return value;
}

function parseChapters(value: unknown): readonly DocumentChapter[] {
  if (!Array.isArray(value)) {
    throw new Error("Document chapters stored in database must be an array");
  }

  return value.map((chapter, index) => {
    if (!chapter || typeof chapter !== "object") {
      throw new Error(`Document chapter ${index} stored in database is invalid`);
    }

    const record = chapter as Record<string, unknown>;
    const chapterTitle = record.chapter_title;
    const startPage = record.start_page;
    const endPage = record.end_page;

    if (typeof chapterTitle !== "string" || chapterTitle.trim().length === 0) {
      throw new Error(`Document chapter ${index} stored in database is invalid`);
    }

    if (
      typeof startPage !== "number" ||
      !Number.isSafeInteger(startPage) ||
      startPage < 1
    ) {
      throw new Error(`Document chapter ${index} stored in database is invalid`);
    }

    if (
      typeof endPage !== "number" ||
      !Number.isSafeInteger(endPage) ||
      endPage < startPage
    ) {
      throw new Error(`Document chapter ${index} stored in database is invalid`);
    }

    return {
      chapterTitle,
      endPage,
      startPage,
    };
  });
}

function toChapterJson(
  chapters: readonly DocumentChapter[],
): Prisma.InputJsonValue {
  return chapters.map((chapter) => ({
    chapter_title: chapter.chapterTitle,
    end_page: chapter.endPage,
    start_page: chapter.startPage,
  }));
}
