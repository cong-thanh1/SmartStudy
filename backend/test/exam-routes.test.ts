import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  ExamDocumentNotFoundError,
  ExamDocumentNotReadyError,
} from "../src/modules/exam/exam-errors.js";
import type { IExamService } from "../src/modules/exam/exam-service.js";
import type { IAuthProvider } from "../src/ports/index.js";
import {
  createChatServiceStub,
  createDocumentServiceStub,
  createTestApp,
} from "./test-app.js";

const userId = "22222222-2222-4222-8222-222222222222";
const documentId = "11111111-1111-4111-8111-111111111111";
const examId = "77777777-7777-4777-8777-777777777777";
const attemptId = "88888888-8888-4888-8888-888888888888";
const createdAt = new Date("2026-07-06T01:00:00.000Z");

function createAuthProvider(): IAuthProvider {
  return {
    login: vi.fn(),
    refresh: vi.fn(),
    register: vi.fn(),
    revokeRefreshToken: vi.fn(),
    verifyToken: vi.fn(async () => ({
      email: "student@example.com",
      role: "student" as const,
      sub: userId,
    })),
  };
}

function createExamServiceStub(): IExamService {
  return {
    generateExam: vi.fn(async () => ({
      createdAt,
      difficultyDistribution: { easy: 50, hard: 0, medium: 50 },
      documentId,
      id: examId,
      numQuestions: 10,
      questions: [
        {
          difficulty: "easy" as const,
          options: ["A", "B", "C", "D"],
          question_id: "eq-1",
          question_text: "Question 1?",
        },
      ],
      timeLimitMinutes: 30,
      userId,
    })),
    getAttempt: vi.fn(async () => ({
      aiFeedback: "Good job!",
      answers: [{ question_id: "eq-1", selected_answer: "A" }],
      detailedResult: [],
      examId,
      id: attemptId,
      maxScore: 10,
      quizId: null,
      score: 10,
      submittedAt: createdAt,
      userId,
    })),
    getExam: vi.fn(async (input) => ({
      answerKey:
        input.mode === "take"
          ? undefined
          : [
              {
                correct_answer: "A",
                explanation: "Expl",
                question_id: "eq-1",
              },
            ],
      createdAt,
      difficultyDistribution: { easy: 50, hard: 0, medium: 50 },
      documentId,
      id: examId,
      numQuestions: 10,
      questions: [
        {
          difficulty: "easy" as const,
          options: ["A", "B", "C", "D"],
          question_id: "eq-1",
          question_text: "Question 1?",
        },
      ],
      timeLimitMinutes: 30,
      userId,
    })),
    listAttempts: vi.fn(async () => []),
    listExams: vi.fn(async () => []),
    submitAttempt: vi.fn(async () => ({
      aiFeedback: "Good job!",
      answers: [{ question_id: "eq-1", selected_answer: "A" }],
      detailedResult: [
        {
          correct_answer: "A",
          explanation: "Expl",
          is_correct: true,
          question_id: "eq-1",
          question_text: "Question 1?",
          selected_answer: "A",
        },
      ],
      examId,
      id: attemptId,
      maxScore: 10,
      quizId: null,
      score: 10,
      submittedAt: createdAt,
      userId,
    })),
  };
}

describe("Exam routes", () => {
  it("POST /api/v1/documents/:documentId/exams generates and returns 201", async () => {
    const authProvider = createAuthProvider();
    const examService = createExamServiceStub();
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      undefined,
      undefined,
      examService,
    );

    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/exams`)
      .set("Authorization", "Bearer token-123")
      .send({ numQuestions: 10, timeLimitMinutes: 30 });

    expect(response.status).toBe(201);
    expect(response.body.exam.id).toBe(examId);
    expect(examService.generateExam).toHaveBeenCalledWith({
      difficultyDistribution: undefined,
      documentId,
      numQuestions: 10,
      timeLimitMinutes: 30,
      userId,
    });
  });

  it("GET /api/v1/exams/:examId?mode=take returns exam without answerKey", async () => {
    const authProvider = createAuthProvider();
    const examService = createExamServiceStub();
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      undefined,
      undefined,
      examService,
    );

    const response = await request(app)
      .get(`/api/v1/exams/${examId}?mode=take`)
      .set("Authorization", "Bearer token-123");

    expect(response.status).toBe(200);
    expect(response.body.exam.id).toBe(examId);
    expect(response.body.exam.answerKey).toBeUndefined();
  });

  it("GET /api/v1/exams/:examId with parameter tampering or invalid mode still never leaks answerKey", async () => {
    const authProvider = createAuthProvider();
    const examService = createExamServiceStub();
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      undefined,
      undefined,
      examService,
    );

    const response = await request(app)
      .get(`/api/v1/exams/${examId}?mode=take&mode=admin&mode=review`)
      .set("Authorization", "Bearer token-123");

    expect(response.status).toBe(200);
    expect(response.body.exam.answerKey).toBeUndefined();
  });

  it("POST /api/v1/exams/:examId/submit grades attempt and returns 201", async () => {
    const authProvider = createAuthProvider();
    const examService = createExamServiceStub();
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      undefined,
      undefined,
      examService,
    );

    const response = await request(app)
      .post(`/api/v1/exams/${examId}/submit`)
      .set("Authorization", "Bearer token-123")
      .send({ answers: [{ question_id: "eq-1", selected_answer: "A" }] });

    expect(response.status).toBe(201);
    expect(response.body.attempt.id).toBe(attemptId);
    expect(response.body.attempt.score).toBe(10);
  });

  it("returns 409 when document is not ready during exam generation", async () => {
    const authProvider = createAuthProvider();
    const examService = createExamServiceStub();
    vi.mocked(examService.generateExam).mockRejectedValueOnce(
      new ExamDocumentNotReadyError(documentId, "uploading"),
    );
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      undefined,
      undefined,
      examService,
    );

    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/exams`)
      .set("Authorization", "Bearer token-123")
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EXAM_DOCUMENT_NOT_READY");
  });
});
