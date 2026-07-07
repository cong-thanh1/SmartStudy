import { describe, expect, it, vi } from "vitest";

import { PrismaExamRepository } from "../src/adapters/exam/prisma-exam-repository.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const createdAt = new Date("2026-07-06T01:00:00.000Z");
const documentId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const examId = "77777777-7777-4777-8777-777777777777";
const attemptId = "88888888-8888-4888-8888-888888888888";

const databaseExam = {
  answerKey: [
    {
      correct_answer: "Option 1",
      explanation: "Expl 1",
      question_id: "eq-1",
    },
  ],
  createdAt,
  difficultyDistribution: { easy: 50, hard: 20, medium: 30 },
  documentId,
  id: examId,
  numQuestions: 1,
  questions: [
    {
      difficulty: "medium",
      options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      question_id: "eq-1",
      question_text: "Question 1?",
    },
  ],
  timeLimitMinutes: 30,
  userId,
};

const databaseAttempt = {
  aiFeedback: "Good job!",
  answers: [{ question_id: "eq-1", selected_answer: "Option 1" }],
  detailedResult: [
    {
      correct_answer: "Option 1",
      explanation: "Expl 1",
      is_correct: true,
      question_id: "eq-1",
      question_text: "Question 1?",
      selected_answer: "Option 1",
    },
  ],
  examId,
  id: attemptId,
  maxScore: "1.00",
  quizId: null,
  score: "1.00",
  submittedAt: createdAt,
  userId,
};

function createPrismaStub() {
  return {
    exam: {
      create: vi.fn(async () => databaseExam),
      findFirst: vi.fn(async () => databaseExam),
      findMany: vi.fn(async () => [databaseExam]),
    },
    examAttempt: {
      create: vi.fn(async () => databaseAttempt),
      findFirst: vi.fn(async () => databaseAttempt),
      findMany: vi.fn(async () => [databaseAttempt]),
    },
  };
}

describe("PrismaExamRepository", () => {
  it("finds owned exam by id and maps fields", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaExamRepository(
      prisma as unknown as PrismaClient,
    );

    const result = await repository.findOwnedById(examId, userId);

    expect(result).toEqual({
      answerKey: [
        {
          correct_answer: "Option 1",
          explanation: "Expl 1",
          question_id: "eq-1",
        },
      ],
      createdAt,
      difficultyDistribution: { easy: 50, hard: 20, medium: 30 },
      documentId,
      id: examId,
      numQuestions: 1,
      questions: [
        {
          difficulty: "medium",
          options: ["Option 1", "Option 2", "Option 3", "Option 4"],
          question_id: "eq-1",
          question_text: "Question 1?",
        },
      ],
      timeLimitMinutes: 30,
      userId,
    });
  });

  it("lists owned exams by document id", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaExamRepository(
      prisma as unknown as PrismaClient,
    );

    const results = await repository.listOwnedByDocument(documentId, userId);

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(examId);
  });

  it("saves a new exam and serializes JSON fields", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaExamRepository(
      prisma as unknown as PrismaClient,
    );

    const result = await repository.save({
      answerKey: [
        {
          correct_answer: "Option 1",
          explanation: "Expl 1",
          question_id: "eq-1",
        },
      ],
      difficultyDistribution: { easy: 50, hard: 20, medium: 30 },
      documentId,
      numQuestions: 1,
      questions: [
        {
          difficulty: "medium",
          options: ["Option 1", "Option 2", "Option 3", "Option 4"],
          question_id: "eq-1",
          question_text: "Question 1?",
        },
      ],
      timeLimitMinutes: 30,
      userId,
    });

    expect(result.id).toBe(examId);
    expect(prisma.exam.create).toHaveBeenCalledTimes(1);
  });

  it("saves and finds exam attempt mapping decimal score to number", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaExamRepository(
      prisma as unknown as PrismaClient,
    );

    const result = await repository.saveAttempt({
      aiFeedback: "Good job!",
      answers: [{ question_id: "eq-1", selected_answer: "Option 1" }],
      detailedResult: [
        {
          correct_answer: "Option 1",
          explanation: "Expl 1",
          is_correct: true,
          question_id: "eq-1",
          question_text: "Question 1?",
          selected_answer: "Option 1",
        },
      ],
      examId,
      maxScore: 1,
      score: 1,
      userId,
    });

    expect(result.score).toBe(1);
    expect(result.maxScore).toBe(1);
    expect(result.id).toBe(attemptId);
  });
});
