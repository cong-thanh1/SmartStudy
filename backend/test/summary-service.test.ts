import { describe, expect, it, vi } from "vitest";

import type {
  DocumentChunkRecord,
  DocumentRecord,
  IDocumentRepository,
} from "../src/modules/documents/document-repository.js";
import {
  SummaryChapterNotFoundError,
  SummaryDocumentNotFoundError,
  SummaryDocumentNotReadyError,
  SummaryGenerationFailedError,
  SummarySourceNotFoundError,
} from "../src/modules/summary/summary-errors.js";
import type {
  ISummaryRepository,
  SummaryRecord,
} from "../src/modules/summary/summary-repository.js";
import { SummaryService } from "../src/modules/summary/summary-service.js";
import type { ILLMProvider } from "../src/ports/index.js";

const userId = "22222222-2222-4222-8222-222222222222";
const documentId = "11111111-1111-4111-8111-111111111111";
const summaryId = "55555555-5555-4555-8555-555555555555";
const createdAt = new Date("2026-07-07T01:00:00.000Z");
const chapterRef = "Chapter 1";

function createDocument(
  status: DocumentRecord["status"] = "ready",
): DocumentRecord {
  return {
    chapters: [{ chapterTitle: "Chapter 1", endPage: 3, startPage: 1 }],
    createdAt,
    fileKey: `users/${userId}/documents/${documentId}.pdf`,
    id: documentId,
    pageCount: 3,
    sizeBytes: 1024,
    status,
    title: "Cell Biology",
    userId,
  };
}

function createSummary(
  scope: SummaryRecord["scope"] = "full",
  chapterRefValue: string | null = null,
): SummaryRecord {
  return {
    chapterRef: chapterRefValue,
    createdAt,
    documentId,
    id: summaryId,
    keyPoints: ["Mitochondria generate ATP", "Cells use membranes"],
    scope,
    summaryText:
      scope === "chapter"
        ? `A cached summary for ${chapterRefValue}.`
        : "A cached full-document summary.",
  };
}

function createChunks(count: number): DocumentChunkRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    chapterTitle: index < 3 ? "Chapter 1" : null,
    chunkText: `Chunk content ${index + 1}`,
    id: `chunk-${index + 1}`,
    pageEnd: index + 1,
    pageStart: index + 1,
  }));
}

function createService() {
  const summaryRepository: ISummaryRepository = {
    findChapterSummary: vi.fn(async () => null),
    findFullDocumentSummary: vi.fn(async () => null),
    saveChapterSummary: vi.fn(async (input): Promise<SummaryRecord> => ({
      chapterRef: input.chapterRef,
      createdAt,
      documentId: input.documentId,
      id: summaryId,
      keyPoints: input.keyPoints,
      scope: "chapter",
      summaryText: input.summaryText,
    })),
    saveFullDocumentSummary: vi.fn(async (input): Promise<SummaryRecord> => ({
      chapterRef: null,
      createdAt,
      documentId: input.documentId,
      id: summaryId,
      keyPoints: input.keyPoints,
      scope: "full",
      summaryText: input.summaryText,
    })),
  };
  const documentRepository: IDocumentRepository = {
    createUploading: vi.fn(async () => createDocument("uploading")),
    findOwnedById: vi.fn(async () => createDocument()),
    listChunks: vi.fn(async () => createChunks(3)),
    listOwned: vi.fn(async () => ({ documents: [createDocument()], total: 1 })),
    markFailed: vi.fn(async () => true),
    markProcessing: vi.fn(async () => true),
    replaceChunksAndMarkReady: vi.fn(async () => true),
    softDeleteOwned: vi.fn(async () => true),
  };
  const generateStructuredJSON = vi.fn(
    async <T>(): Promise<T> =>
      ({
        keyPoints: [" Key 1 ", "Key 2"],
        summaryText: " Generated full summary. ",
      }) as T,
  ) as unknown as ILLMProvider["generateStructuredJSON"];
  const llmProvider: ILLMProvider = {
    generateStructuredJSON,
    generateText: vi.fn(async () => ({
      text: " Section summary. ",
    })),
  };
  const service = new SummaryService(
    summaryRepository,
    documentRepository,
    llmProvider,
  );

  return {
    documentRepository,
    llmProvider,
    service,
    summaryRepository,
  };
}

describe("SummaryService", () => {
  it("returns a cached chapter summary after verifying ownership", async () => {
    const { documentRepository, llmProvider, service, summaryRepository } =
      createService();
    const cached = createSummary("chapter", chapterRef);
    vi.mocked(summaryRepository.findChapterSummary).mockResolvedValueOnce(
      cached,
    );

    await expect(
      service.summarizeChapter({ chapterRef, documentId, userId }),
    ).resolves.toEqual(cached);
    expect(documentRepository.findOwnedById).toHaveBeenCalledWith(
      documentId,
      userId,
    );
    expect(summaryRepository.findChapterSummary).toHaveBeenCalledWith({
      chapterRef,
      documentId,
    });
    expect(documentRepository.listChunks).not.toHaveBeenCalled();
    expect(llmProvider.generateStructuredJSON).not.toHaveBeenCalled();
  });

  it("does not leak cached chapter summaries for documents the user does not own", async () => {
    const { documentRepository, service, summaryRepository } = createService();
    vi.mocked(documentRepository.findOwnedById).mockResolvedValueOnce(null);
    vi.mocked(summaryRepository.findChapterSummary).mockResolvedValueOnce(
      createSummary("chapter", chapterRef),
    );

    await expect(
      service.summarizeChapter({
        chapterRef,
        documentId,
        userId: "other-user",
      }),
    ).rejects.toThrow(SummaryDocumentNotFoundError);
    expect(summaryRepository.findChapterSummary).not.toHaveBeenCalled();
  });

  it("rejects unknown chapters before cache or LLM work", async () => {
    const { llmProvider, service, summaryRepository } = createService();

    await expect(
      service.summarizeChapter({
        chapterRef: "Missing chapter",
        documentId,
        userId,
      }),
    ).rejects.toThrow(SummaryChapterNotFoundError);
    expect(summaryRepository.findChapterSummary).not.toHaveBeenCalled();
    expect(llmProvider.generateStructuredJSON).not.toHaveBeenCalled();
  });

  it("generates and saves a chapter summary from matching chunks", async () => {
    const { documentRepository, llmProvider, service, summaryRepository } =
      createService();

    const result = await service.summarizeChapter({
      chapterRef: ` ${chapterRef} `,
      documentId,
      userId,
    });

    expect(documentRepository.listChunks).toHaveBeenCalledWith({
      chapterTitle: chapterRef,
      documentId,
      userId,
    });
    expect(llmProvider.generateStructuredJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining(`chapter "${chapterRef}"`),
      }),
    );
    expect(summaryRepository.saveChapterSummary).toHaveBeenCalledWith({
      chapterRef,
      documentId,
      keyPoints: ["Key 1", "Key 2"],
      summaryText: "Generated full summary.",
    });
    expect(result).toMatchObject({
      chapterRef,
      scope: "chapter",
    });
  });

  it("throws when a known chapter has no extracted chunks", async () => {
    const { documentRepository, service, summaryRepository } = createService();
    vi.mocked(documentRepository.listChunks).mockResolvedValueOnce([]);

    await expect(
      service.summarizeChapter({ chapterRef, documentId, userId }),
    ).rejects.toThrow(SummaryChapterNotFoundError);
    expect(summaryRepository.saveChapterSummary).not.toHaveBeenCalled();
  });

  it("gets a cached chapter summary without generation", async () => {
    const { llmProvider, service, summaryRepository } = createService();
    const cached = createSummary("chapter", chapterRef);
    vi.mocked(summaryRepository.findChapterSummary).mockResolvedValueOnce(
      cached,
    );

    await expect(
      service.getChapterSummary({ chapterRef, documentId, userId }),
    ).resolves.toEqual(cached);
    expect(llmProvider.generateStructuredJSON).not.toHaveBeenCalled();
  });

  it("returns a cached full-document summary after verifying ownership", async () => {
    const { documentRepository, llmProvider, service, summaryRepository } =
      createService();
    vi.mocked(summaryRepository.findFullDocumentSummary).mockResolvedValueOnce(
      createSummary(),
    );

    await expect(
      service.summarizeFullDocument({ documentId, userId }),
    ).resolves.toEqual(createSummary());
    expect(documentRepository.findOwnedById).toHaveBeenCalledWith(
      documentId,
      userId,
    );
    expect(summaryRepository.findFullDocumentSummary).toHaveBeenCalledWith(
      documentId,
    );
    expect(documentRepository.listChunks).not.toHaveBeenCalled();
    expect(llmProvider.generateStructuredJSON).not.toHaveBeenCalled();
  });

  it("does not leak cached summaries for documents the user does not own", async () => {
    const { documentRepository, service, summaryRepository } = createService();
    vi.mocked(documentRepository.findOwnedById).mockResolvedValueOnce(null);
    vi.mocked(summaryRepository.findFullDocumentSummary).mockResolvedValueOnce(
      createSummary(),
    );

    await expect(
      service.summarizeFullDocument({ documentId, userId: "other-user" }),
    ).rejects.toThrow(SummaryDocumentNotFoundError);
    expect(summaryRepository.findFullDocumentSummary).not.toHaveBeenCalled();
  });

  it("rejects non-ready documents before cache or LLM work", async () => {
    const { documentRepository, llmProvider, service, summaryRepository } =
      createService();
    vi.mocked(documentRepository.findOwnedById).mockResolvedValueOnce(
      createDocument("processing"),
    );

    await expect(
      service.summarizeFullDocument({ documentId, userId }),
    ).rejects.toThrow(SummaryDocumentNotReadyError);
    expect(summaryRepository.findFullDocumentSummary).not.toHaveBeenCalled();
    expect(llmProvider.generateStructuredJSON).not.toHaveBeenCalled();
  });

  it("generates and saves a direct full-document summary for small documents", async () => {
    const { documentRepository, llmProvider, service, summaryRepository } =
      createService();

    const result = await service.summarizeFullDocument({
      documentId,
      userId,
    });

    expect(documentRepository.listChunks).toHaveBeenCalledWith({
      documentId,
      userId,
    });
    expect(llmProvider.generateText).not.toHaveBeenCalled();
    expect(llmProvider.generateStructuredJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            content: expect.stringContaining("Chunk content 1"),
            role: "user",
          },
        ],
      }),
    );
    expect(summaryRepository.saveFullDocumentSummary).toHaveBeenCalledWith({
      documentId,
      keyPoints: ["Key 1", "Key 2"],
      summaryText: "Generated full summary.",
    });
    expect(result.scope).toBe("full");
  });

  it("uses map-reduce when a document has more than five chunks", async () => {
    const { documentRepository, llmProvider, service, summaryRepository } =
      createService();
    vi.mocked(documentRepository.listChunks).mockResolvedValueOnce(
      createChunks(7),
    );

    await service.summarizeFullDocument({
      documentId,
      userId,
    });

    expect(llmProvider.generateText).toHaveBeenCalledTimes(2);
    expect(llmProvider.generateStructuredJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            content: [
              "Section 1:",
              "Section summary.",
              "",
              "Section 2:",
              "Section summary.",
            ].join("\n"),
            role: "user",
          },
        ],
      }),
    );
    expect(summaryRepository.saveFullDocumentSummary).toHaveBeenCalledOnce();
  });

  it("force refresh bypasses cache but still verifies ownership", async () => {
    const { documentRepository, service, summaryRepository } = createService();

    await service.summarizeFullDocument({
      documentId,
      forceRefresh: true,
      userId,
    });

    expect(documentRepository.findOwnedById).toHaveBeenCalledWith(
      documentId,
      userId,
    );
    expect(summaryRepository.findFullDocumentSummary).not.toHaveBeenCalled();
    expect(summaryRepository.saveFullDocumentSummary).toHaveBeenCalledOnce();
  });

  it("throws when the document has no extracted chunks", async () => {
    const { documentRepository, service, summaryRepository } = createService();
    vi.mocked(documentRepository.listChunks).mockResolvedValueOnce([]);

    await expect(
      service.summarizeFullDocument({ documentId, userId }),
    ).rejects.toThrow(SummarySourceNotFoundError);
    expect(summaryRepository.saveFullDocumentSummary).not.toHaveBeenCalled();
  });

  it("throws when the LLM returns invalid summary JSON", async () => {
    const { llmProvider, service, summaryRepository } = createService();
    vi.mocked(llmProvider.generateStructuredJSON).mockImplementationOnce(
      async <T>(): Promise<T> =>
        ({
          keyPoints: [],
          summaryText: "",
        }) as T,
    );

    await expect(
      service.summarizeFullDocument({ documentId, userId }),
    ).rejects.toThrow(SummaryGenerationFailedError);
    expect(summaryRepository.saveFullDocumentSummary).not.toHaveBeenCalled();
  });

  it("gets a cached full-document summary without generation", async () => {
    const { llmProvider, service, summaryRepository } = createService();
    vi.mocked(summaryRepository.findFullDocumentSummary).mockResolvedValueOnce(
      createSummary(),
    );

    await expect(
      service.getFullDocumentSummary({ documentId, userId }),
    ).resolves.toEqual(createSummary());
    expect(llmProvider.generateStructuredJSON).not.toHaveBeenCalled();
  });
});
