import { describe, expect, it, vi } from "vitest";

import { PrismaQuizRepository } from "../src/adapters/quiz/prisma-quiz-repository.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const createdAt = new Date("2026-07-06T01:00:00.000Z");
const documentId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const quizId = "66666666-6666-4666-8666-666666666666";

const databaseQuiz = {
  createdAt,
  difficulty: "medium",
  documentId,
  id: quizId,
  questions: [
    {
      correct_answer: "Paris",
      explanation: "Paris is the capital of France.",
      options: ["Paris", "London", "Berlin", "Madrid"],
      question_id: "q-1",
      question_text: "What is the capital of France?",
    },
  ],
  userId,
};

function createPrismaStub() {
  return {
    quiz: {
      create: vi.fn(async () => databaseQuiz),
      findFirst: vi.fn(async (): Promise<typeof databaseQuiz | null> => databaseQuiz),
      findMany: vi.fn(async () => [databaseQuiz]),
    },
  };
}

describe("PrismaQuizRepository", () => {
  it("finds owned quiz by id and maps fields", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaQuizRepository(
      prisma as unknown as PrismaClient,
    );

    const result = await repository.findOwnedById(quizId, userId);

    expect(result).toEqual({
      createdAt,
      difficulty: "medium",
      documentId,
      id: quizId,
      questions: [
        {
          correct_answer: "Paris",
          explanation: "Paris is the capital of France.",
          options: ["Paris", "London", "Berlin", "Madrid"],
          question_id: "q-1",
          question_text: "What is the capital of France?",
        },
      ],
      userId,
    });
    expect(prisma.quiz.findFirst).toHaveBeenCalledWith({
      select: expect.any(Object),
      where: {
        id: quizId,
        userId,
      },
    });
  });

  it("returns null when quiz not found or not owned", async () => {
    const prisma = createPrismaStub();
    prisma.quiz.findFirst.mockResolvedValueOnce(null);
    const repository = new PrismaQuizRepository(
      prisma as unknown as PrismaClient,
    );

    const result = await repository.findOwnedById(quizId, "other-user");

    expect(result).toBeNull();
  });

  it("lists owned quizzes by document id", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaQuizRepository(
      prisma as unknown as PrismaClient,
    );

    const results = await repository.listOwnedByDocument(documentId, userId);

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(quizId);
    expect(prisma.quiz.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      select: expect.any(Object),
      where: {
        documentId,
        userId,
      },
    });
  });

  it("saves a new quiz and serializes questions", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaQuizRepository(
      prisma as unknown as PrismaClient,
    );

    const result = await repository.save({
      difficulty: "medium",
      documentId,
      questions: [
        {
          correct_answer: "Paris",
          explanation: "Paris is the capital of France.",
          options: ["Paris", "London", "Berlin", "Madrid"],
          question_id: "q-1",
          question_text: "What is the capital of France?",
        },
      ],
      userId,
    });

    expect(result.id).toBe(quizId);
    expect(prisma.quiz.create).toHaveBeenCalledWith({
      data: {
        difficulty: "medium",
        documentId,
        questions: [
          {
            correct_answer: "Paris",
            explanation: "Paris is the capital of France.",
            options: ["Paris", "London", "Berlin", "Madrid"],
            question_id: "q-1",
            question_text: "What is the capital of France?",
          },
        ],
        userId,
      },
      select: expect.any(Object),
    });
  });
});
