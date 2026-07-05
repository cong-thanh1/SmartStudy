import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  IVectorStore,
  VectorRecord,
  VectorSearchQuery,
  VectorSearchResult,
} from "../../ports/index.js";
import { toPgVectorLiteral } from "./pg-vector-utils.js";

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 50;

interface DatabaseVectorSearchRow {
  readonly chapterTitle: string | null;
  readonly documentId: string;
  readonly id: string;
  readonly pageEnd: number | null;
  readonly pageStart: number | null;
  readonly similarity: unknown;
  readonly text: string;
}

export class PgVectorStore implements IVectorStore {
  constructor(private readonly prisma: PrismaClient) {}

  async deleteByDocument(input: {
    readonly documentId: string;
    readonly userId: string;
  }): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM "document_chunks" AS c
      USING "documents" AS d
      WHERE c."document_id" = d."id"
        AND d."id" = ${input.documentId}::uuid
        AND d."user_id" = ${input.userId}::uuid
        AND d."deleted" = false
    `;
  }

  async similaritySearch(
    query: VectorSearchQuery,
  ): Promise<VectorSearchResult[]> {
    const topK = normalizeTopK(query.topK);
    const queryEmbedding = toPgVectorLiteral(
      query.embedding,
      "Vector search embedding",
    );

    const rows = await this.prisma.$queryRaw<DatabaseVectorSearchRow[]>`
      WITH query_embedding AS (
        SELECT ${queryEmbedding}::vector AS "embedding"
      )
      SELECT
        c."id" AS "id",
        c."document_id" AS "documentId",
        c."chunk_text" AS "text",
        c."chapter_title" AS "chapterTitle",
        c."page_start" AS "pageStart",
        c."page_end" AS "pageEnd",
        1 - (c."embedding" <=> q."embedding") AS "similarity"
      FROM "document_chunks" AS c
      JOIN "documents" AS d ON d."id" = c."document_id"
      CROSS JOIN query_embedding AS q
      WHERE d."id" = ${query.documentId}::uuid
        AND d."user_id" = ${query.userId}::uuid
        AND d."deleted" = false
        AND d."status" = 'ready'
        AND c."embedding" IS NOT NULL
      ORDER BY c."embedding" <=> q."embedding"
      LIMIT ${topK}
    `;

    return rows.map(mapSearchRow);
  }

  async upsertEmbeddings(records: readonly VectorRecord[]): Promise<void> {
    for (const record of records) {
      const normalized = normalizeVectorRecord(record);

      await this.prisma.$executeRaw`
        INSERT INTO "document_chunks" (
          "id",
          "document_id",
          "chunk_text",
          "chapter_title",
          "page_start",
          "page_end",
          "embedding"
        )
        SELECT
          ${normalized.id}::uuid,
          d."id",
          ${normalized.text},
          ${normalized.chapterTitle},
          ${normalized.pageStart},
          ${normalized.pageEnd},
          ${normalized.embedding}::vector
        FROM "documents" AS d
        WHERE d."id" = ${normalized.documentId}::uuid
          AND d."user_id" = ${normalized.userId}::uuid
          AND d."deleted" = false
        ON CONFLICT ("id") DO UPDATE SET
          "document_id" = EXCLUDED."document_id",
          "chunk_text" = EXCLUDED."chunk_text",
          "chapter_title" = EXCLUDED."chapter_title",
          "page_start" = EXCLUDED."page_start",
          "page_end" = EXCLUDED."page_end",
          "embedding" = EXCLUDED."embedding"
        WHERE EXISTS (
          SELECT 1
          FROM "documents" AS owner
          WHERE owner."id" = "document_chunks"."document_id"
            AND owner."user_id" = ${normalized.userId}::uuid
            AND owner."deleted" = false
        )
      `;
    }
  }
}

interface NormalizedVectorRecord {
  readonly chapterTitle: string | null;
  readonly documentId: string;
  readonly embedding: string;
  readonly id: string;
  readonly pageEnd: number | null;
  readonly pageStart: number | null;
  readonly text: string;
  readonly userId: string;
}

function normalizeVectorRecord(record: VectorRecord): NormalizedVectorRecord {
  const text = record.text.trim();

  if (text.length === 0) {
    throw new RangeError("Vector record text must not be empty");
  }

  const pageStart = normalizeOptionalPage(record.pageStart, "pageStart");
  const pageEnd = normalizeOptionalPage(record.pageEnd, "pageEnd");

  if (pageStart !== null && pageEnd !== null && pageEnd < pageStart) {
    throw new RangeError("Vector record pageEnd must be greater than or equal to pageStart");
  }

  return {
    chapterTitle: normalizeOptionalText(record.chapterTitle),
    documentId: record.documentId,
    embedding: toPgVectorLiteral(record.embedding, "Vector record embedding"),
    id: record.id,
    pageEnd,
    pageStart,
    text,
    userId: record.userId,
  };
}

function normalizeOptionalPage(
  value: number | undefined,
  fieldName: string,
): number | null {
  if (value === undefined) {
    return null;
  }

  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`Vector record ${fieldName} must be a positive integer`);
  }

  return value;
}

function normalizeOptionalText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

function normalizeTopK(topK: number | undefined): number {
  if (topK === undefined) {
    return DEFAULT_TOP_K;
  }

  if (!Number.isSafeInteger(topK) || topK < 1 || topK > MAX_TOP_K) {
    throw new RangeError(
      `Vector search topK must be an integer between 1 and ${MAX_TOP_K}`,
    );
  }

  return topK;
}

function mapSearchRow(row: DatabaseVectorSearchRow): VectorSearchResult {
  return {
    documentId: row.documentId,
    id: row.id,
    similarity: parseSimilarity(row.similarity),
    text: row.text,
    ...(row.chapterTitle === null ? {} : { chapterTitle: row.chapterTitle }),
    ...(row.pageEnd === null ? {} : { pageEnd: row.pageEnd }),
    ...(row.pageStart === null ? {} : { pageStart: row.pageStart }),
  };
}

function parseSimilarity(value: unknown): number {
  const similarity = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(similarity)) {
    throw new Error("Vector search similarity returned by database is invalid");
  }

  return similarity;
}