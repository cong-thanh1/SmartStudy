export type SummaryScope = "full";

export interface SummaryRecord {
  readonly chapterRef: null;
  readonly createdAt: Date;
  readonly documentId: string;
  readonly id: string;
  readonly keyPoints: readonly string[];
  readonly scope: SummaryScope;
  readonly summaryText: string;
}

export interface SaveFullDocumentSummaryInput {
  readonly documentId: string;
  readonly keyPoints: readonly string[];
  readonly summaryText: string;
}

export interface ISummaryRepository {
  findFullDocumentSummary(
    documentId: string,
  ): Promise<SummaryRecord | null>;
  saveFullDocumentSummary(
    input: SaveFullDocumentSummaryInput,
  ): Promise<SummaryRecord>;
}
