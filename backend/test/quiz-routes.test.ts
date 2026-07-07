import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  QuizDocumentNotFoundError,
  QuizDocumentNotReadyError,
} from "../src/modules/quiz/quiz-errors.js";
import type { IQuizService } from "../src/modules/quiz/quiz-service.js";
import type { IAuthProvider } from "../src/ports/index.js";
import {
  createChatServiceStub,
  createDocumentServiceStub,
  createTestApp,
} from "./test-app.js";

const userId = "22222222-2222-4222-8222-222222222222";
const documentId = "11111111-1111-4111-8111-111111111111";
const quizId = "66666666-6666-4666-8666-666666666666";
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

function createQuizServiceStub(): IQuizService {
  return {
    generateQuiz: vi.fn(async () => ({
      createdAt,
      difficulty: "medium" as const,
      documentId,
      id: quizId,
      questions: [
        {
          correct_answer: "Option 1",
          explanation: "Explanation 1.",
          options: ["Option 1", "Option 2", "Option 3", "Option 4"],
          question_id: "q-1",
          question_text: "Question 1?",
        },
      ],
      userId,
    })),
    getQuiz: vi.fn(async () => ({
      createdAt,
      difficulty: "medium" as const,
      documentId,
      id: quizId,
      questions: [
        {
          correct_answer: "Option 1",
          explanation: "Explanation 1.",
          options: ["Option 1", "Option 2", "Option 3", "Option 4"],
          question_id: "q-1",
          question_text: "Question 1?",
        },
      ],
      userId,
    })),
    listQuizzes: vi.fn(async () => [
      {
        createdAt,
        difficulty: "medium" as const,
        documentId,
        id: quizId,
        questions: [],
        userId,
      },
    ]),
  };
}

describe("Quiz routes", () => {
  it("POST /api/v1/documents/:documentId/quizzes generates and returns 201", async () => {
    const authProvider = createAuthProvider();
    const quizService = createQuizServiceStub();
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      undefined,
      quizService,
    );

    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/quizzes`)
      .set("Authorization", "Bearer token-123")
      .send({ difficulty: "medium", numQuestions: 5 });

    expect(response.status).toBe(201);
    expect(response.body.quiz.id).toBe(quizId);
    expect(quizService.generateQuiz).toHaveBeenCalledWith({
      difficulty: "medium",
      documentId,
      numQuestions: 5,
      userId,
    });
  });

  it("GET /api/v1/documents/:documentId/quizzes lists quizzes and returns 200", async () => {
    const authProvider = createAuthProvider();
    const quizService = createQuizServiceStub();
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      undefined,
      quizService,
    );

    const response = await request(app)
      .get(`/api/v1/documents/${documentId}/quizzes`)
      .set("Authorization", "Bearer token-123");

    expect(response.status).toBe(200);
    expect(response.body.quizzes).toHaveLength(1);
    expect(quizService.listQuizzes).toHaveBeenCalledWith({
      documentId,
      userId,
    });
  });

  it("GET /api/v1/quizzes/:quizId returns quiz detail with 200", async () => {
    const authProvider = createAuthProvider();
    const quizService = createQuizServiceStub();
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      undefined,
      quizService,
    );

    const response = await request(app)
      .get(`/api/v1/quizzes/${quizId}`)
      .set("Authorization", "Bearer token-123");

    expect(response.status).toBe(200);
    expect(response.body.quiz.id).toBe(quizId);
  });

  it("returns 409 when document is not ready during quiz generation", async () => {
    const authProvider = createAuthProvider();
    const quizService = createQuizServiceStub();
    vi.mocked(quizService.generateQuiz).mockRejectedValueOnce(
      new QuizDocumentNotReadyError(documentId, "uploading"),
    );
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      undefined,
      quizService,
    );

    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/quizzes`)
      .set("Authorization", "Bearer token-123")
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("QUIZ_DOCUMENT_NOT_READY");
  });

  it("returns 404 when document is not found during quiz generation", async () => {
    const authProvider = createAuthProvider();
    const quizService = createQuizServiceStub();
    vi.mocked(quizService.generateQuiz).mockRejectedValueOnce(
      new QuizDocumentNotFoundError(documentId),
    );
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      undefined,
      quizService,
    );

    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/quizzes`)
      .set("Authorization", "Bearer token-123")
      .send({});

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("QUIZ_DOCUMENT_NOT_FOUND");
  });
});
