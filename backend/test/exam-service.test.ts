import { describe, expect, it, vi } from "vitest";

import type {
  DocumentChunkRecord,
  DocumentRecord,
  IDocumentRepository,
} from "../src/modules/documents/document-repository.js";
import {
  ExamDocumentNotFoundError,
  ExamDocumentNotReadyError,
  ExamGenerationError,
  ExamNotFoundError,
} from "../src/modules/exam/exam-errors.js";
import type {
  ExamAttemptRecord,
  ExamRecord,
  IExamRepository,
} from "../src/modules/exam/exam-repository.js";
import { ExamService } from "../src/modules/exam/exam-service.js";
import type { IQuizRepository, QuizRecord } from "../src/modules/quiz/quiz-repository.js";
import type { ILLMProvider } from "../src/ports/index.js";

const userId = "22222222-2222-4222-8222-222222222222";
const documentId = "11111111-1111-4111-8111-111111111111";
const examId = "77777777-7777-4777-8777-777777777777";
const quizId = "66666666-6666-4666-8666-666666666666";
const attemptId = "88888888-8888-4888-8888-888888888888";
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

function createExam(): ExamRecord {
  return {
    answerKey: [
      {
        correct_answer: "Option A",
        explanation: "A is correct.",
        question_id: "eq-1",
      },
      {
        correct_answer: "Option B",
        explanation: "B is correct.",
        question_id: "eq-2",
      },
    ],
    createdAt,
    difficultyDistribution: { easy: 50, hard: 0, medium: 50 },
    documentId,
    id: examId,
    numQuestions: 2,
    questions: [
      {
        difficulty: "easy",
        options: ["Option A", "Option B", "Option C", "Option D"],
        question_id: "eq-1",
        question_text: "Question 1?",
      },
      {
        difficulty: "medium",
        options: ["Option A", "Option B", "Option C", "Option D"],
        question_id: "eq-2",
        question_text: "Question 2?",
      },
    ],
    timeLimitMinutes: 30,
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
        correct_answer: "Option A",
        explanation: "Quiz expl.",
        options: ["Option A", "Option B", "Option C", "Option D"],
        question_id: "q-1",
        question_text: "Quiz Q1?",
      },
    ],
    userId,
  };
}

function createAttempt(): ExamAttemptRecord {
  return {
    aiFeedback: "Good effort! Review concept B.",
    answers: [
      { question_id: "eq-1", selected_answer: "Option A" },
      { question_id: "eq-2", selected_answer: "Option C" }, // Wrong answer
    ],
    detailedResult: [
      {
        correct_answer: "Option A",
        explanation: "A is correct.",
        is_correct: true,
        question_id: "eq-1",
        question_text: "Question 1?",
        selected_answer: "Option A",
      },
      {
        correct_answer: "Option B",
        explanation: "B is correct.",
        is_correct: false,
        question_id: "eq-2",
        question_text: "Question 2?",
        selected_answer: "Option C",
      },
    ],
    examId,
    id: attemptId,
    maxScore: 2,
    quizId: null,
    score: 1,
    submittedAt: createdAt,
    userId,
  };
}

function createChunks(): DocumentChunkRecord[] {
  return [
    {
      chapterTitle: "Chapter 1",
      chunkText: "Study content for exam.",
      id: "chunk-1",
      pageEnd: 1,
      pageStart: 1,
    },
  ];
}

function createServiceStubs() {
  const examRepository: IExamRepository = {
    findAttemptById: vi.fn(async (id, owner) =>
      id === attemptId && owner === userId ? createAttempt() : null,
    ),
    findOwnedById: vi.fn(async (id, owner) =>
      id === examId && owner === userId ? createExam() : null,
    ),
    listAttemptsByExam: vi.fn(async () => [createAttempt()]),
    listOwnedByDocument: vi.fn(async () => [createExam()]),
    save: vi.fn(async (input) => ({
      answerKey: input.answerKey,
      createdAt,
      difficultyDistribution: input.difficultyDistribution ?? null,
      documentId: input.documentId,
      id: examId,
      numQuestions: input.numQuestions,
      questions: input.questions,
      timeLimitMinutes: input.timeLimitMinutes ?? null,
      userId: input.userId,
    })),
    saveAttempt: vi.fn(async (input) => ({
      aiFeedback: input.aiFeedback ?? null,
      answers: input.answers,
      detailedResult: input.detailedResult,
      examId: input.examId ?? null,
      id: attemptId,
      maxScore: input.maxScore,
      quizId: input.quizId ?? null,
      score: input.score,
      submittedAt: createdAt,
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

  const quizRepository: IQuizRepository = {
    findOwnedById: vi.fn(async (id, owner) =>
      id === quizId && owner === userId ? createQuiz() : null,
    ),
    listOwnedByDocument: vi.fn(async () => [createQuiz()]),
    save: vi.fn(),
  };

  const llmProvider: ILLMProvider = {
    generateStructuredJSON: vi.fn(async () => ({
      questions: [
        {
          correct_answer: "Option A",
          difficulty: "easy",
          explanation: "A is correct.",
          options: ["Option A", "Option B", "Option C", "Option D"],
          question_id: "eq-1",
          question_text: "Question 1?",
        },
      ],
    })),
    generateText: vi.fn(async () => ({
      model: "test-model",
      text: "Good effort! Review concept B.",
    })),
  };

  const service = new ExamService(
    examRepository,
    documentRepository,
    quizRepository,
    llmProvider,
  );

  return { documentRepository, examRepository, llmProvider, quizRepository, service };
}

describe("ExamService", () => {
  describe("generateExam", () => {
    it("generates exam, separating questions and answerKey", async () => {
      const { examRepository, service } = createServiceStubs();

      const result = await service.generateExam({
        documentId,
        numQuestions: 1,
        userId,
      });

      expect(result.id).toBe(examId);
      expect(result.questions[0]).not.toHaveProperty("correct_answer");
      expect(result.questions[0]).not.toHaveProperty("explanation");
      expect(result.answerKey?.[0]?.correct_answer).toBe("Option A");
      expect(examRepository.save).toHaveBeenCalledTimes(1);
    });

    it("throws ExamDocumentNotReadyError when document is uploading", async () => {
      const { documentRepository, service } = createServiceStubs();
      vi.mocked(documentRepository.findOwnedById).mockResolvedValueOnce(
        createDocument("uploading"),
      );

      await expect(service.generateExam({ documentId, userId })).rejects.toThrow(
        ExamDocumentNotReadyError,
      );
    });
  });

  describe("getExam", () => {
    it("strips answerKey when mode is take to prevent leaking answers", async () => {
      const { service } = createServiceStubs();

      const result = await service.getExam({
        examId,
        mode: "take",
        userId,
      });

      expect(result.id).toBe(examId);
      expect(result.answerKey).toBeUndefined();
    });

    it("includes answerKey when mode is review or grade", async () => {
      const { service } = createServiceStubs();

      const result = await service.getExam({
        examId,
        mode: "review",
        userId,
      });

      expect(result.answerKey).toBeDefined();
      expect(result.answerKey).toHaveLength(2);
    });

    it("throws ExamNotFoundError when exam not owned", async () => {
      const { service } = createServiceStubs();

      await expect(
        service.getExam({ examId, userId: "other-user" }),
      ).rejects.toThrow(ExamNotFoundError);
    });
  });

  describe("listExams", () => {
    it("lists exams without answerKey by default", async () => {
      const { service } = createServiceStubs();

      const results = await service.listExams({ documentId, userId });

      expect(results).toHaveLength(1);
      expect(results[0]?.answerKey).toBeUndefined();
    });
  });

  describe("submitAttempt", () => {
    it("performs pure JS comparison grading and calculates score", async () => {
      const { examRepository, llmProvider, service } = createServiceStubs();

      const attempt = await service.submitAttempt({
        answers: [
          { question_id: "eq-1", selected_answer: "Option A" }, // Correct
          { question_id: "eq-2", selected_answer: "Option C" }, // Wrong (should be B)
        ],
        examId,
        userId,
      });

      expect(attempt.score).toBe(1);
      expect(attempt.maxScore).toBe(2);
      expect(attempt.detailedResult).toHaveLength(2);
      expect(attempt.detailedResult?.[0]?.is_correct).toBe(true);
      expect(attempt.detailedResult?.[1]?.is_correct).toBe(false);
      expect(llmProvider.generateText).toHaveBeenCalledTimes(1);
      expect(examRepository.saveAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          aiFeedback: "Good effort! Review concept B.",
          maxScore: 2,
          score: 1,
        }),
      );
    });

    it("supports submitting quiz attempt as well", async () => {
      const { examRepository, service } = createServiceStubs();

      const attempt = await service.submitAttempt({
        answers: [{ question_id: "q-1", selected_answer: "Option A" }],
        quizId,
        userId,
      });

      expect(attempt.score).toBe(1);
      expect(attempt.maxScore).toBe(1);
      expect(examRepository.saveAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          quizId,
          score: 1,
        }),
      );
    });

    it("handles double submission (race condition / concurrent submits) safely without corrupting grading", async () => {
      const { examRepository, service } = createServiceStubs();

      const [attempt1, attempt2] = await Promise.all([
        service.submitAttempt({
          answers: [{ question_id: "eq-1", selected_answer: "Option A" }],
          examId,
          userId,
        }),
        service.submitAttempt({
          answers: [{ question_id: "eq-1", selected_answer: "Option A" }],
          examId,
          userId,
        }),
      ]);

      expect(attempt1.score).toBe(1);
      expect(attempt2.score).toBe(1);
      expect(examRepository.saveAttempt).toHaveBeenCalledTimes(2);
    });
  });
});
