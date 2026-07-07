import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  ISummaryRepository,
  SaveSummaryInput,
  SummaryRecord,
  SummaryScope,
} from "../../modules/summary/summary-repository.js";

const CHAPTER_SUMMARY_SCOPE = "chapter";
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

  async findChapterSummary(input: {
    readonly chapterRef: string;
    readonly documentId: string;
  }): Promise<SummaryRecord | null> {
    return this.findCached({
      chapterRef: input.chapterRef,
      documentId: input.documentId,
      scope: CHAPTER_SUMMARY_SCOPE,
    });
  }

  async findFullDocumentSummary(
    documentId: string,
  ): Promise<SummaryRecord | null> {
    return this.findCached({
      chapterRef: null,
      documentId,
      scope: FULL_SUMMARY_SCOPE,
    });
  }

  async saveChapterSummary(input: {
    readonly chapterRef: string;
    readonly documentId: string;
    readonly keyPoints: readonly string[];
    readonly summaryText: string;
  }): Promise<SummaryRecord> {
    return this.saveSummary({
      chapterRef: input.chapterRef,
      documentId: input.documentId,
      keyPoints: input.keyPoints,
      scope: CHAPTER_SUMMARY_SCOPE,
      summaryText: input.summaryText,
    });
  }

  async saveFullDocumentSummary(input: {
    readonly documentId: string;
    readonly keyPoints: readonly string[];
    readonly summaryText: string;
  }): Promise<SummaryRecord> {
    return this.saveSummary({
      chapterRef: null,
      documentId: input.documentId,
      keyPoints: input.keyPoints,
      scope: FULL_SUMMARY_SCOPE,
      summaryText: input.summaryText,
    });
  }

  private async findCached(input: {
    readonly chapterRef: string | null;
    readonly documentId: string;
    readonly scope: SummaryScope;
  }): Promise<SummaryRecord | null> {
    const summary = await this.prisma.summary.findFirst({
      select: summarySelection,
      where: {
        chapterRef: input.chapterRef,
        documentId: input.documentId,
        scope: input.scope,
      },
    });

    return summary ? mapSummary(summary) : null;
  }

  private async saveSummary(input: SaveSummaryInput): Promise<SummaryRecord> {
    const chapterRef = input.chapterRef ?? null;
    const existing = await this.prisma.summary.findFirst({
      select: {
        id: true,
      },
      where: {
        chapterRef,
        documentId: input.documentId,
        scope: input.scope,
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
        chapterRef,
        documentId: input.documentId,
        keyPoints: toKeyPointsJson(input.keyPoints),
        scope: input.scope,
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
  if (!isSummaryScope(record.scope)) {
    throw new Error("Unsupported summary scope stored in database");
  }

  if (record.scope === FULL_SUMMARY_SCOPE && record.chapterRef !== null) {
    throw new Error("Full-document summary cache row must not have chapterRef");
  }

  if (record.scope === CHAPTER_SUMMARY_SCOPE && record.chapterRef === null) {
    throw new Error("Chapter summary cache row must have chapterRef");
  }

  return {
    chapterRef: record.chapterRef,
    createdAt: record.createdAt,
    documentId: record.documentId,
    id: record.id,
    keyPoints: parseKeyPoints(record.keyPoints),
    scope: record.scope,
    summaryText: record.summaryText,
  };
}

function isSummaryScope(scope: string): scope is SummaryScope {
  return scope === CHAPTER_SUMMARY_SCOPE || scope === FULL_SUMMARY_SCOPE;
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
