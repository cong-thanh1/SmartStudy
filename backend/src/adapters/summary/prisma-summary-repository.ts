import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  ISummaryRepository,
  SaveFullDocumentSummaryInput,
  SummaryRecord,
} from "../../modules/summary/summary-repository.js";

const FULL_SUMMARY_SCOPE = "full";

const summarySelection = {
  chapterRef: true,
  createdAt: true,
  documentId: true,
  id: true,
  keyPoints: true,
  scope: true,
  summaryText: true,
} as const;

export class PrismaSummaryRepository implements ISummaryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findFullDocumentSummary(
    documentId: string,
  ): Promise<SummaryRecord | null> {
    const summary = await this.prisma.summary.findFirst({
      select: summarySelection,
      where: {
        chapterRef: null,
        documentId,
        scope: FULL_SUMMARY_SCOPE,
      },
    });

    return summary ? mapSummary(summary) : null;
  }

  async saveFullDocumentSummary(
    input: SaveFullDocumentSummaryInput,
  ): Promise<SummaryRecord> {
    const existing = await this.prisma.summary.findFirst({
      select: {
        id: true,
      },
      where: {
        chapterRef: null,
        documentId: input.documentId,
        scope: FULL_SUMMARY_SCOPE,
      },
    });

    if (existing) {
      const updated = await this.prisma.summary.update({
        data: {
          keyPoints: toKeyPointsJson(input.keyPoints),
          summaryText: input.summaryText,
        },
        select: summarySelection,
        where: {
          id: existing.id,
        },
      });

      return mapSummary(updated);
    }

    const created = await this.prisma.summary.create({
      data: {
        chapterRef: null,
        documentId: input.documentId,
        keyPoints: toKeyPointsJson(input.keyPoints),
        scope: FULL_SUMMARY_SCOPE,
        summaryText: input.summaryText,
      },
      select: summarySelection,
    });

    return mapSummary(created);
  }
}

function mapSummary(record: {
  readonly chapterRef: string | null;
  readonly createdAt: Date;
  readonly documentId: string;
  readonly id: string;
  readonly keyPoints: unknown;
  readonly scope: string;
  readonly summaryText: string;
}): SummaryRecord {
  if (record.scope !== FULL_SUMMARY_SCOPE || record.chapterRef !== null) {
    throw new Error("Database summary record was not a full-document summary");
  }

  return {
    chapterRef: null,
    createdAt: record.createdAt,
    documentId: record.documentId,
    id: record.id,
    keyPoints: parseKeyPoints(record.keyPoints),
    scope: "full",
    summaryText: record.summaryText,
  };
}

function parseKeyPoints(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error("Summary key points stored in database must be an array");
  }

  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`Summary key point ${index} stored in database is invalid`);
    }

    return item;
  });
}

function toKeyPointsJson(keyPoints: readonly string[]): Prisma.InputJsonValue {
  return keyPoints.map((keyPoint) => keyPoint.trim());
}
