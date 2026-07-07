import { describe, expect, it, vi } from "vitest";

import type {
  DocumentChunkRecord,
  DocumentRecord,
  IDocumentRepository,
} from "../src/modules/documents/document-repository.js";
import {
  QuizDocumentNotFoundError,
  QuizDocumentNotReadyError,
  QuizGenerationError,
  QuizNotFoundError,
} from "../src/modules/quiz/quiz-errors.js";
import type {
  IQuizRepository,
  QuizRecord,
} from "../src/modules/quiz/quiz-repository.js";
import { QuizService } from "../src/modules/quiz/quiz-service.js";
import type { ILLMProvider } from "../src/ports/index.js";

const userId = "22222222-2222-4222-8222-222222222222";
const documentId = "11111111-1111-4111-8111-111111111111";
const quizId = "66666666-6666-4666-8666-666666666666";
const createdAt = new Date("2026-07-06T01:00:00.000Z");

function createDocument(
  status: DocumentRecord["status"] = "ready",
): DocumentRecord {
  return {
    chapters: [],
    createdAt,
    fileKey: `users/${userId}/documents/${documentId}.pdf`,
    id: documentId,
    pageCount: 5,
    sizeBytes: 1024,
    status,
    title: "Test Document",
    userId,
  };
}

function createQuiz(): QuizRecord {
  return {
    createdAt,
    difficulty: "medium",
    documentId,
    id: quizId,
    questions: [
      {
        correct_answer: "Option 1",
        explanation: "Because 1 is right.",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        question_id: "q-1",
        question_text: "Which option is right?",
      },
    ],
    userId,
  };
}

function createChunks(): DocumentChunkRecord[] {
  return [
    {
      chapterTitle: "Chapter 1",
      chunkText: "This is some chunk text for testing.",
      id: "chunk-1",
      pageEnd: 1,
      pageStart: 1,
    },
  ];
}

function createServiceStubs() {
  const quizRepository: IQuizRepository = {
    findOwnedById: vi.fn(async (id, owner) =>
      id === quizId && owner === userId ? createQuiz() : null,
    ),
    listOwnedByDocument: vi.fn(async () => [createQuiz()]),
    save: vi.fn(async (input) => ({
      createdAt,
      difficulty: input.difficulty ?? null,
      documentId: input.documentId,
      id: quizId,
      questions: input.questions,
      userId: input.userId,
    })),
  };

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
    generateStructuredJSON: vi.fn(async () => ({
      questions: [
        {
          correct_answer: "Option A",
          explanation: "Clear explanation.",
          options: ["Option A", "Option B", "Option C", "Option D"],
          question_id: "q-10",
          question_text: "Sample Question?",
        },
      ],
    })),
    generateText: vi.fn(),
  };

  const service = new QuizService(
    quizRepository,
    documentRepository,
    llmProvider,
  );

  return { documentRepository, llmProvider, quizRepository, service };
}

describe("QuizService", () => {
  describe("generateQuiz", () => {
    it("generates and saves quiz on first attempt when LLM output is valid", async () => {
      const { llmProvider, quizRepository, service } = createServiceStubs();

      const result = await service.generateQuiz({
        difficulty: "medium",
        documentId,
        numQuestions: 5,
        userId,
      });

      expect(result.id).toBe(quizId);
      expect(llmProvider.generateStructuredJSON).toHaveBeenCalledTimes(1);
      expect(quizRepository.save).toHaveBeenCalledWith({
        difficulty: "medium",
        documentId,
        questions: [
          {
            correct_answer: "Option A",
            explanation: "Clear explanation.",
            options: ["Option A", "Option B", "Option C", "Option D"],
            question_id: "q-10",
            question_text: "Sample Question?",
          },
        ],
        userId,
      });
    });

    it("normalizes correct_answer when option letter A/B/C/D is returned", async () => {
      const { llmProvider, quizRepository, service } = createServiceStubs();
      vi.mocked(llmProvider.generateStructuredJSON).mockResolvedValueOnce({
        questions: [
          {
            correct_answer: "B", // Option letter
            explanation: "Explanation B.",
            options: ["First", "Second", "Third", "Fourth"],
            question_id: "q-1",
            question_text: "Select second?",
          },
        ],
      });

      await service.generateQuiz({ documentId, userId });

      expect(quizRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          questions: [
            {
              correct_answer: "Second",
              explanation: "Explanation B.",
              options: ["First", "Second", "Third", "Fourth"],
              question_id: "q-1",
              question_text: "Select second?",
            },
          ],
        }),
      );
    });

    it("retries when Zod schema validation fails and succeeds on retry", async () => {
      const { llmProvider, quizRepository, service } = createServiceStubs();
      // First attempt returns invalid schema (missing options array)
      vi.mocked(llmProvider.generateStructuredJSON)
        .mockResolvedValueOnce({ questions: [{ question_text: "Bad" }] })
        .mockResolvedValueOnce({
          questions: [
            {
              correct_answer: "Opt 1",
              explanation: "Valid now.",
              options: ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
              question_id: "q-2",
              question_text: "Good question?",
            },
          ],
        });

      const result = await service.generateQuiz({ documentId, userId });

      expect(llmProvider.generateStructuredJSON).toHaveBeenCalledTimes(2);
      expect(result.id).toBe(quizId);
      expect(quizRepository.save).toHaveBeenCalledTimes(1);
    });

    it("throws QuizGenerationError after 3 failed retries", async () => {
      const { llmProvider, service } = createServiceStubs();
      vi.mocked(llmProvider.generateStructuredJSON).mockRejectedValue(
        new Error("LLM provider unavailable"),
      );

      await expect(service.generateQuiz({ documentId, userId })).rejects.toThrow(
        QuizGenerationError,
      );
      expect(llmProvider.generateStructuredJSON).toHaveBeenCalledTimes(3);
    });

    it("throws QuizDocumentNotFoundError when document not owned", async () => {
      const { service } = createServiceStubs();

      await expect(
        service.generateQuiz({ documentId, userId: "other-user" }),
      ).rejects.toThrow(QuizDocumentNotFoundError);
    });

    it("throws QuizDocumentNotReadyError when document status is not ready", async () => {
      const { documentRepository, service } = createServiceStubs();
      vi.mocked(documentRepository.findOwnedById).mockResolvedValueOnce(
        createDocument("uploading"),
      );

      await expect(service.generateQuiz({ documentId, userId })).rejects.toThrow(
        QuizDocumentNotReadyError,
      );
    });

    it("throws QuizGenerationError when document has 0 chunks", async () => {
      const { documentRepository, service } = createServiceStubs();
      vi.mocked(documentRepository.listChunks).mockResolvedValueOnce([]);

      await expect(service.generateQuiz({ documentId, userId })).rejects.toThrow(
        QuizGenerationError,
      );
    });
  });

  describe("getQuiz", () => {
    it("returns quiz when found and owned", async () => {
      const { service } = createServiceStubs();

      const result = await service.getQuiz({ quizId, userId });

      expect(result).toEqual(createQuiz());
    });

    it("throws QuizNotFoundError when quiz not found or not owned", async () => {
      const { service } = createServiceStubs();

      await expect(
        service.getQuiz({ quizId, userId: "other-user" }),
      ).rejects.toThrow(QuizNotFoundError);
    });
  });

  describe("listQuizzes", () => {
    it("lists owned quizzes for a document", async () => {
      const { service } = createServiceStubs();

      const results = await service.listQuizzes({ documentId, userId });

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(quizId);
    });

    it("throws QuizDocumentNotFoundError when document not owned during list", async () => {
      const { service } = createServiceStubs();

      await expect(
        service.listQuizzes({ documentId, userId: "other-user" }),
      ).rejects.toThrow(QuizDocumentNotFoundError);
    });
  });
});
