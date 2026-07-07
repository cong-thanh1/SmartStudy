import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  ExamAnswerKeyItem,
  ExamAttemptAnswer,
  ExamAttemptDetailItem,
  ExamAttemptRecord,
  ExamDifficulty,
  ExamQuestion,
  ExamRecord,
  IExamRepository,
  SaveExamAttemptInput,
  SaveExamInput,
} from "../../modules/exam/exam-repository.js";

const examSelection = {
  answerKey: true,
  createdAt: true,
  difficultyDistribution: true,
  documentId: true,
  id: true,
  numQuestions: true,
  questions: true,
  timeLimitMinutes: true,
  userId: true,
} as const;

const attemptSelection = {
  aiFeedback: true,
  answers: true,
  detailedResult: true,
  examId: true,
  id: true,
  maxScore: true,
  quizId: true,
  score: true,
  submittedAt: true,
  userId: true,
} as const;

export class PrismaExamRepository implements IExamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOwnedById(id: string, userId: string): Promise<ExamRecord | null> {
    const exam = await this.prisma.exam.findFirst({
      select: examSelection,
      where: {
        id,
        userId,
      },
    });

    return exam ? mapExam(exam) : null;
  }

  async listOwnedByDocument(
    documentId: string,
    userId: string,
  ): Promise<readonly ExamRecord[]> {
    const exams = await this.prisma.exam.findMany({
      orderBy: { createdAt: "desc" },
      select: examSelection,
      where: {
        documentId,
        userId,
      },
    });

    return exams.map(mapExam);
  }

  async save(input: SaveExamInput): Promise<ExamRecord> {
    const exam = await this.prisma.exam.create({
      data: {
        answerKey: toAnswerKeyJson(input.answerKey),
        difficultyDistribution:
          (input.difficultyDistribution as Prisma.InputJsonValue) ?? null,
        documentId: input.documentId,
        numQuestions: input.numQuestions,
        questions: toQuestionsJson(input.questions),
        timeLimitMinutes: input.timeLimitMinutes ?? null,
        userId: input.userId,
      },
      select: examSelection,
    });

    return mapExam(exam);
  }

  async findAttemptById(
    id: string,
    userId: string,
  ): Promise<ExamAttemptRecord | null> {
    const attempt = await this.prisma.examAttempt.findFirst({
      select: attemptSelection,
      where: {
        id,
        userId,
      },
    });

    return attempt ? mapAttempt(attempt) : null;
  }

  async listAttemptsByExam(
    examId: string,
    userId: string,
  ): Promise<readonly ExamAttemptRecord[]> {
    const attempts = await this.prisma.examAttempt.findMany({
      orderBy: { submittedAt: "desc" },
      select: attemptSelection,
      where: {
        examId,
        userId,
      },
    });

    return attempts.map(mapAttempt);
  }

  async saveAttempt(
    input: SaveExamAttemptInput,
  ): Promise<ExamAttemptRecord> {
    const attempt = await this.prisma.examAttempt.create({
      data: {
        aiFeedback: input.aiFeedback ?? null,
        answers: toAnswersJson(input.answers),
        detailedResult: toDetailedResultJson(input.detailedResult),
        examId: input.examId ?? null,
        maxScore: input.maxScore,
        quizId: input.quizId ?? null,
        score: input.score,
        userId: input.userId,
      },
      select: attemptSelection,
    });

    return mapAttempt(attempt);
  }
}

function mapExam(record: {
  readonly answerKey: unknown;
  readonly createdAt: Date;
  readonly difficultyDistribution: unknown;
  readonly documentId: string;
  readonly id: string;
  readonly numQuestions: number;
  readonly questions: unknown;
  readonly timeLimitMinutes: number | null;
  readonly userId: string;
}): ExamRecord {
  return {
    answerKey: fromAnswerKeyJson(record.answerKey),
    createdAt: record.createdAt,
    difficultyDistribution:
      typeof record.difficultyDistribution === "object" &&
      record.difficultyDistribution !== null
        ? (record.difficultyDistribution as Record<string, number>)
        : null,
    documentId: record.documentId,
    id: record.id,
    numQuestions: record.numQuestions,
    questions: fromQuestionsJson(record.questions),
    timeLimitMinutes: record.timeLimitMinutes,
    userId: record.userId,
  };
}

function mapAttempt(record: {
  readonly aiFeedback: string | null;
  readonly answers: unknown;
  readonly detailedResult: unknown;
  readonly examId: string | null;
  readonly id: string;
  readonly maxScore: unknown;
  readonly quizId: string | null;
  readonly score: unknown;
  readonly submittedAt: Date;
  readonly userId: string;
}): ExamAttemptRecord {
  return {
    aiFeedback: record.aiFeedback,
    answers: fromAnswersJson(record.answers),
    detailedResult: fromDetailedResultJson(record.detailedResult),
    examId: record.examId,
    id: record.id,
    maxScore: record.maxScore !== null ? Number(record.maxScore) : null,
    quizId: record.quizId,
    score: record.score !== null ? Number(record.score) : null,
    submittedAt: record.submittedAt,
    userId: record.userId,
  };
}

function fromQuestionsJson(value: unknown): readonly ExamQuestion[] {
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
        typeof item.question_id === "string"
          ? item.question_id
          : `eq-${index + 1}`;
      const questionText =
        typeof item.question_text === "string" ? item.question_text : "";
      const options = Array.isArray(item.options)
        ? item.options.filter((opt): opt is string => typeof opt === "string")
        : [];
      const difficulty =
        typeof item.difficulty === "string"
          ? (item.difficulty as ExamDifficulty)
          : undefined;

      return {
        options,
        question_id: questionId,
        question_text: questionText,
        ...(difficulty === undefined ? {} : { difficulty }),
      };
    });
}

function toQuestionsJson(
  questions: readonly ExamQuestion[],
): Prisma.InputJsonValue {
  return questions.map((q) => ({
    options: [...q.options],
    question_id: q.question_id,
    question_text: q.question_text,
    ...(q.difficulty === undefined ? {} : { difficulty: q.difficulty }),
  }));
}

function fromAnswerKeyJson(value: unknown): readonly ExamAnswerKeyItem[] {
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
        typeof item.question_id === "string"
          ? item.question_id
          : `eq-${index + 1}`;
      const correctAnswer =
        typeof item.correct_answer === "string" ? item.correct_answer : "";
      const explanation =
        typeof item.explanation === "string" ? item.explanation : "";

      return {
        correct_answer: correctAnswer,
        explanation,
        question_id: questionId,
      };
    });
}

function toAnswerKeyJson(
  answerKey: readonly ExamAnswerKeyItem[],
): Prisma.InputJsonValue {
  return answerKey.map((a) => ({
    correct_answer: a.correct_answer,
    explanation: a.explanation,
    question_id: a.question_id,
  }));
}

function fromAnswersJson(value: unknown): readonly ExamAttemptAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) => ({
      question_id:
        typeof item.question_id === "string" ? item.question_id : "",
      selected_answer:
        typeof item.selected_answer === "string" ? item.selected_answer : "",
    }));
}

function toAnswersJson(
  answers: readonly ExamAttemptAnswer[],
): Prisma.InputJsonValue {
  return answers.map((a) => ({
    question_id: a.question_id,
    selected_answer: a.selected_answer,
  }));
}

function fromDetailedResultJson(
  value: unknown,
): readonly ExamAttemptDetailItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) => ({
      correct_answer:
        typeof item.correct_answer === "string" ? item.correct_answer : "",
      explanation:
        typeof item.explanation === "string" ? item.explanation : "",
      is_correct: Boolean(item.is_correct),
      question_id:
        typeof item.question_id === "string" ? item.question_id : "",
      question_text:
        typeof item.question_text === "string" ? item.question_text : "",
      selected_answer:
        typeof item.selected_answer === "string" ? item.selected_answer : "",
    }));
}

function toDetailedResultJson(
  result: readonly ExamAttemptDetailItem[],
): Prisma.InputJsonValue {
  return result.map((r) => ({
    correct_answer: r.correct_answer,
    explanation: r.explanation,
    is_correct: r.is_correct,
    question_id: r.question_id,
    question_text: r.question_text,
    selected_answer: r.selected_answer,
  }));
}
