import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  IQuizRepository,
  QuizDifficulty,
  QuizQuestion,
  QuizRecord,
  SaveQuizInput,
} from "../../modules/quiz/quiz-repository.js";

const quizSelection = {
  createdAt: true,
  difficulty: true,
  documentId: true,
  id: true,
  questions: true,
  userId: true,
} as const;

export class PrismaQuizRepository implements IQuizRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOwnedById(id: string, userId: string): Promise<QuizRecord | null> {
    const quiz = await this.prisma.quiz.findFirst({
      select: quizSelection,
      where: {
        id,
        userId,
      },
    });

    return quiz ? mapQuiz(quiz) : null;
  }

  async listOwnedByDocument(
    documentId: string,
    userId: string,
  ): Promise<readonly QuizRecord[]> {
    const quizzes = await this.prisma.quiz.findMany({
      orderBy: { createdAt: "desc" },
      select: quizSelection,
      where: {
        documentId,
        userId,
      },
    });

    return quizzes.map(mapQuiz);
  }

  async save(input: SaveQuizInput): Promise<QuizRecord> {
    const quiz = await this.prisma.quiz.create({
      data: {
        difficulty: input.difficulty ?? null,
        documentId: input.documentId,
        questions: toQuestionsJson(input.questions),
        userId: input.userId,
      },
      select: quizSelection,
    });

    return mapQuiz(quiz);
  }
}

function mapQuiz(record: {
  readonly createdAt: Date;
  readonly difficulty: string | null;
  readonly documentId: string;
  readonly id: string;
  readonly questions: unknown;
  readonly userId: string;
}): QuizRecord {
  return {
    createdAt: record.createdAt,
    difficulty: (record.difficulty as QuizDifficulty | null) ?? null,
    documentId: record.documentId,
    id: record.id,
    questions: fromQuestionsJson(record.questions),
    userId: record.userId,
  };
}

function fromQuestionsJson(value: unknown): readonly QuizQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item, index) => {
      const questionId =
        typeof item.question_id === "string" ? item.question_id : `q-${index + 1}`;
      const questionText =
        typeof item.question_text === "string" ? item.question_text : "";
      const explanation =
        typeof item.explanation === "string" ? item.explanation : "";
      const correctAnswer =
        typeof item.correct_answer === "string" ? item.correct_answer : "";
      const options = Array.isArray(item.options)
        ? item.options.filter((opt): opt is string => typeof opt === "string")
        : [];

      return {
        correct_answer: correctAnswer,
        explanation,
        options,
        question_id: questionId,
        question_text: questionText,
      };
    });
}

function toQuestionsJson(
  questions: readonly QuizQuestion[],
): Prisma.InputJsonValue {
  return questions.map((q) => ({
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    options: [...q.options],
    question_id: q.question_id,
    question_text: q.question_text,
  }));
}
