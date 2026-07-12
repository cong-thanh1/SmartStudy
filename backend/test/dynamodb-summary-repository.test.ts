import { describe, expect, it } from "vitest";
import { DynamoDbSummaryRepository } from "../src/adapters/summary/dynamodb-summary-repository.js";

class Client { constructor(private readonly responses: unknown[]) {} async send(): Promise<unknown> { return this.responses.shift() ?? {}; } }

describe("DynamoDbSummaryRepository", () => {
  it("caches full and chapter summaries using separate deterministic keys", async () => {
    const repository = new DynamoDbSummaryRepository("summaries", () => new Date("2026-07-13T00:00:00.000Z"), () => "00000000-0000-0000-0000-000000000001", new Client([{}, {}]));
    await expect(repository.saveFullDocumentSummary({ documentId: "document-1", keyPoints: ["A"], summaryText: "Full" })).resolves.toMatchObject({ scope: "full", chapterRef: null });
    await expect(repository.saveChapterSummary({ documentId: "document-1", chapterRef: "chapter-1", keyPoints: ["B"], summaryText: "Chapter" })).resolves.toMatchObject({ scope: "chapter", chapterRef: "chapter-1" });
  });
});
