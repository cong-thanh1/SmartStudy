export type SummaryScope = "chapter" | "full";

export interface SummaryRecord {
  readonly chapterRef: string | null;
  readonly createdAt: Date;
  readonly documentId: string;
  readonly id: string;
  readonly keyPoints: readonly string[];
  readonly scope: SummaryScope;
  readonly summaryText: string;
}

export interface SaveSummaryInput {
  readonly chapterRef?: string | null;
  readonly documentId: string;
  readonly keyPoints: readonly string[];
  readonly scope: SummaryScope;
  readonly summaryText: string;
}

export interface ISummaryRepository {
  findChapterSummary(input: {
    readonly chapterRef: string;
    readonly documentId: string;
  }): Promise<SummaryRecord | null>;
  findFullDocumentSummary(
    documentId: string,
  ): Promise<SummaryRecord | null>;
  saveChapterSummary(input: {
    readonly chapterRef: string;
    readonly documentId: string;
    readonly keyPoints: readonly string[];
    readonly summaryText: string;
  }): Promise<SummaryRecord>;
  saveFullDocumentSummary(
    input: {
      readonly documentId: string;
      readonly keyPoints: readonly string[];
      readonly summaryText: string;
    },
  ): Promise<SummaryRecord>;
}
