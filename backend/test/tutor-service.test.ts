import { describe, expect, it, vi } from "vitest";

import type {
  DocumentChunkRecord,
  DocumentRecord,
  IDocumentRepository,
} from "../src/modules/documents/document-repository.js";
import {
  TutorDocumentNotFoundError,
  TutorGenerationError,
} from "../src/modules/tutor/tutor-errors.js";
import { TutorService } from "../src/modules/tutor/tutor-service.js";
import type { ILLMProvider } from "../src/ports/index.js";

const userId = "22222222-2222-4222-8222-222222222222";
const documentId = "11111111-1111-4111-8111-111111111111";
const createdAt = new Date("2026-07-06T01:00:00.000Z");

function createDocument(): DocumentRecord {
  return {
    chapters: [],
    createdAt,
    fileKey: `users/${userId}/documents/${documentId}.pdf`,
    id: documentId,
    pageCount: 5,
    sizeBytes: 1024,
    status: "ready",
    title: "Test Document",
    userId,
  };
}

function createChunks(): DocumentChunkRecord[] {
  return [
    {
      chapterTitle: "Chapter 1",
      chunkText: "Tutor reference text.",
      id: "chunk-1",
      pageEnd: 1,
      pageStart: 1,
    },
  ];
}

function createServiceStubs() {
  const documentRepository: IDocumentRepository = {
    createUploading: vi.fn(),
    findOwnedById: vi.fn(async (id, owner) =>
      id === documentId && owner === userId ? createDocument() : null,
    ),
    listChunks: vi.fn(async () => createChunks()),
    listOwned: vi.fn(),
    markFailed: vi.fn(),
    markProcessing: vi.fn(),
    replaceChunksAndMarkReady: vi.fn(),
    softDeleteOwned: vi.fn(),
  };

  const llmProvider: ILLMProvider = {
    generateStructuredJSON: vi.fn(),
    generateText: vi.fn(async () => ({
      model: "test-model",
      text: "Socratic guidance response.",
    })),
  };

  const service = new TutorService(documentRepository, llmProvider);

  return { documentRepository, llmProvider, service };
}

describe("TutorService", () => {
  it("generates tutoring answer with document context", async () => {
    const { llmProvider, service } = createServiceStubs();

    const result = await service.ask({
      documentId,
      question: "Explain calculus?",
      userId,
    });

    expect(result.answer).toBe("Socratic guidance response.");
    expect(result.model).toBe("configured-llm");
    expect(llmProvider.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxTokens: 192,
        systemPrompt: expect.stringContaining("Tutor reference text."),
      }),
    );
  });

  it("bounds document context and recent history for local inference", async () => {
    const { documentRepository, llmProvider, service } = createServiceStubs();
    vi.mocked(documentRepository.listChunks).mockResolvedValueOnce([
      {
        chapterTitle: "Large chapter",
        chunkText: "A".repeat(8_000),
        id: "large-chunk",
        pageEnd: 2,
        pageStart: 1,
      },
    ]);

    await service.ask({
      documentId,
      history: Array.from({ length: 10 }, (_, index) => ({
        content: `${index}:` + "H".repeat(1_200),
        role: index % 2 === 0 ? "user" as const : "assistant" as const,
      })),
      question: "Explain the selected document.",
      userId,
    });

    const request = vi.mocked(llmProvider.generateText).mock.calls[0]?.[0];
    expect(request?.maxTokens).toBe(192);
    expect(request?.messages).toHaveLength(7);
    expect(request?.messages[0]?.content).not.toContain("0:");
    expect(request?.messages[0]?.content.length).toBe(1_000);
    expect(request?.systemPrompt?.length).toBeLessThan(5_000);
  });

  it("answers out-of-scope questions cleanly without document context or hallucinating references", async () => {
    const { llmProvider, service } = createServiceStubs();

    const result = await service.ask({
      question: "What is general relativity?",
      userId,
    });

    expect(result.answer).toBe("Socratic guidance response.");
    expect(llmProvider.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.not.stringContaining("Tutor reference text."),
      }),
    );
  });

  it("throws TutorDocumentNotFoundError when document is not owned", async () => {
    const { service } = createServiceStubs();

    await expect(
      service.ask({
        documentId,
        question: "Explain?",
        userId: "other-user",
      }),
    ).rejects.toThrow(TutorDocumentNotFoundError);
  });

  it("throws TutorGenerationError when LLM fails", async () => {
    const { llmProvider, service } = createServiceStubs();
    vi.mocked(llmProvider.generateText).mockRejectedValueOnce(
      new Error("API timeout"),
    );

    await expect(
      service.ask({
        question: "Hello?",
        userId,
      }),
    ).rejects.toThrow(TutorGenerationError);
  });
});
