import type { ILLMProvider } from "../../ports/index.js";
import type { IDocumentRepository } from "../documents/document-repository.js";
import type { IQuizRepository } from "../quiz/quiz-repository.js";
import {
  ExamAttemptNotFoundError,
  ExamDocumentNotFoundError,
  ExamDocumentNotReadyError,
  ExamGenerationError,
  ExamNotFoundError,
} from "./exam-errors.js";
import type {
  ExamAnswerKeyItem,
  ExamAttemptDetailItem,
  ExamAttemptRecord,
  ExamQuestion,
  ExamRecord,
  IExamRepository,
} from "./exam-repository.js";
import {
  generatedExamSchema,
  type GeneratedExamQuestion,
} from "./exam-schemas.js";

export interface GenerateExamInput {
  readonly difficultyDistribution?: Record<string, number>;
  readonly documentId: string;
  readonly numQuestions?: number;
  readonly timeLimitMinutes?: number;
  readonly userId: string;
}

export interface GetExamInput {
  readonly examId: string;
  readonly mode?: "grade" | "review" | "take";
  readonly userId: string;
}

export interface ListExamsInput {
  readonly documentId: string;
  readonly userId: string;
}

export interface SubmitAttemptInput {
  readonly answers: readonly { readonly question_id: string; readonly selected_answer: string }[];
  readonly examId?: string;
  readonly quizId?: string;
  readonly userId: string;
}

export interface GetAttemptInput {
  readonly attemptId: string;
  readonly userId: string;
}

export interface IExamService {
  generateExam(input: GenerateExamInput): Promise<ExamRecord>;
  getAttempt(input: GetAttemptInput): Promise<ExamAttemptRecord>;
  getExam(input: GetExamInput): Promise<ExamRecord>;
  listAttempts(examId: string, userId: string): Promise<readonly ExamAttemptRecord[]>;
  listExams(input: ListExamsInput): Promise<readonly ExamRecord[]>;
  submitAttempt(input: SubmitAttemptInput): Promise<ExamAttemptRecord>;
}

export class ExamService implements IExamService {
  constructor(
    private readonly examRepository: IExamRepository,
    private readonly documentRepository: IDocumentRepository,
    private readonly quizRepository: IQuizRepository,
    private readonly llmProvider: ILLMProvider,
  ) {}

  async generateExam(input: GenerateExamInput): Promise<ExamRecord> {
    const document = await this.documentRepository.findOwnedById(
      input.documentId,
      input.userId,
    );
    if (!document) {
      throw new ExamDocumentNotFoundError(input.documentId);
    }
    if (document.status !== "ready") {
      throw new ExamDocumentNotReadyError(input.documentId, document.status);
    }

    const chunks = await this.documentRepository.listChunks({
      documentId: input.documentId,
      userId: input.userId,
    });
    if (chunks.length === 0) {
      throw new ExamGenerationError(
        "No document content available to generate exam.",
      );
    }

    const sourceText = chunks
      .slice(0, 20)
      .map((c) => c.chunkText)
      .join("\n\n");
    const numQuestions = input.numQuestions ?? 10;
    const diffText = input.difficultyDistribution
      ? `Difficulty distribution: ${JSON.stringify(input.difficultyDistribution)}.`
      : "Balanced difficulty across easy, medium, and hard.";

    const systemPrompt = `You are an expert academic examiner. Generate an examination with exactly ${numQuestions} multiple-choice questions based on the provided text. ${diffText} Each question MUST have exactly 4 options, 1 correct answer (matching one option exactly or A/B/C/D), an explanation, and an assigned difficulty (easy, medium, or hard). Return ONLY a JSON object matching the requested schema without markdown or extra text.`;
    const schemaDescription =
      "An object with property 'questions' which is an array of objects containing question_id, question_text, options (4 strings), correct_answer, explanation, and difficulty.";

    const maxAttempts = 3;
    let lastError = "Unknown error during exam generation.";

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const rawResult = await this.llmProvider.generateStructuredJSON<unknown>(
          {
            messages: [{ content: sourceText, role: "user" }],
            schemaDescription,
            systemPrompt,
            temperature: 0.4,
          },
        );

        const parsed = generatedExamSchema.safeParse(rawResult);
        if (!parsed.success) {
          lastError = `Zod validation failed: ${parsed.error.message}`;
          continue;
        }

        const { answerKey, questions } = this.splitQuestionsAndAnswerKey(
          parsed.data.questions,
        );
        if (questions.length === 0 || answerKey.length === 0) {
          lastError = "No valid questions after parsing.";
          continue;
        }

        return await this.examRepository.save({
          answerKey,
          difficultyDistribution: input.difficultyDistribution ?? null,
          documentId: input.documentId,
          numQuestions: questions.length,
          questions,
          timeLimitMinutes: input.timeLimitMinutes ?? null,
          userId: input.userId,
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new ExamGenerationError(
      `Failed to generate exam after ${maxAttempts} attempts. Last error: ${lastError}`,
    );
  }

  async getExam(input: GetExamInput): Promise<ExamRecord> {
    const exam = await this.examRepository.findOwnedById(
      input.examId,
      input.userId,
    );
    if (!exam) {
      throw new ExamNotFoundError(input.examId);
    }

    if (input.mode === "take") {
      const { answerKey: _answerKey, ...examWithoutAnswerKey } = exam;
      void _answerKey;

      return examWithoutAnswerKey;
    }

    return exam;
  }

  async listExams(input: ListExamsInput): Promise<readonly ExamRecord[]> {
    const document = await this.documentRepository.findOwnedById(
      input.documentId,
      input.userId,
    );
    if (!document) {
      throw new ExamDocumentNotFoundError(input.documentId);
    }

    const exams = await this.examRepository.listOwnedByDocument(
      input.documentId,
      input.userId,
    );

    return exams.map((exam) => {
      const { answerKey: _answerKey, ...examWithoutAnswerKey } = exam;
      void _answerKey;

      return examWithoutAnswerKey;
    });
  }

  async submitAttempt(input: SubmitAttemptInput): Promise<ExamAttemptRecord> {
    let answerKey: readonly { readonly correct_answer: string; readonly explanation: string; readonly question_id: string; readonly question_text?: string }[] = [];

    if (input.examId) {
      const exam = await this.examRepository.findOwnedById(
        input.examId,
        input.userId,
      );
      if (!exam || !exam.answerKey) {
        throw new ExamNotFoundError(input.examId);
      }
      const questionsMap = new Map(
        exam.questions.map((q) => [q.question_id, q.question_text]),
      );
      answerKey = exam.answerKey.map((a) => ({
        ...a,
        question_text: questionsMap.get(a.question_id) ?? "",
      }));
    } else if (input.quizId) {
      const quiz = await this.quizRepository.findOwnedById(
        input.quizId,
        input.userId,
      );
      if (!quiz) {
        throw new ExamNotFoundError(input.quizId);
      }
      answerKey = quiz.questions.map((q) => ({
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        question_id: q.question_id,
        question_text: q.question_text,
      }));
    } else {
      throw new ExamNotFoundError("Either examId or quizId must be provided.");
    }

    const userAnswersMap = new Map(
      input.answers.map((a) => [a.question_id, a.selected_answer]),
    );

    let score = 0;
    const detailedResult: ExamAttemptDetailItem[] = [];

    for (const item of answerKey) {
      const selectedAnswer = userAnswersMap.get(item.question_id) ?? "";
      const isCorrect =
        selectedAnswer.trim().toLowerCase() ===
        item.correct_answer.trim().toLowerCase();
      if (isCorrect) {
        score += 1;
      }
      detailedResult.push({
        correct_answer: item.correct_answer,
        explanation: item.explanation,
        is_correct: isCorrect,
        question_id: item.question_id,
        question_text: item.question_text ?? "",
        selected_answer: selectedAnswer,
      });
    }

    const maxScore = answerKey.length;
    const aiFeedback = await this.generateAiFeedback(score, maxScore, detailedResult);

    return this.examRepository.saveAttempt({
      aiFeedback,
      answers: input.answers,
      detailedResult,
      examId: input.examId ?? null,
      maxScore,
      quizId: input.quizId ?? null,
      score,
      userId: input.userId,
    });
  }

  async getAttempt(input: GetAttemptInput): Promise<ExamAttemptRecord> {
    const attempt = await this.examRepository.findAttemptById(
      input.attemptId,
      input.userId,
    );
    if (!attempt) {
      throw new ExamAttemptNotFoundError(input.attemptId);
    }
    return attempt;
  }

  async listAttempts(
    examId: string,
    userId: string,
  ): Promise<readonly ExamAttemptRecord[]> {
    return this.examRepository.listAttemptsByExam(examId, userId);
  }

  private splitQuestionsAndAnswerKey(
    questions: readonly GeneratedExamQuestion[],
  ): {
    readonly answerKey: readonly ExamAnswerKeyItem[];
    readonly questions: readonly ExamQuestion[];
  } {
    const cleanQuestions: ExamQuestion[] = [];
    const answerKey: ExamAnswerKeyItem[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q || q.options.length !== 4) {
        continue;
      }

      const questionId = q.question_id.trim() || `eq-${i + 1}`;
      const options = [
        q.options[0] ?? "",
        q.options[1] ?? "",
        q.options[2] ?? "",
        q.options[3] ?? "",
      ] as const;

      let correctAnswer = q.correct_answer.trim();
      const exactMatchIdx = options.findIndex(
        (o) => o.toLowerCase() === correctAnswer.toLowerCase(),
      );
      if (exactMatchIdx !== -1) {
        correctAnswer = options[exactMatchIdx] ?? correctAnswer;
      } else {
        const upper = correctAnswer.toUpperCase();
        if (upper === "A" || upper === "0") {
          correctAnswer = options[0];
        } else if (upper === "B" || upper === "1") {
          correctAnswer = options[1];
        } else if (upper === "C" || upper === "2") {
          correctAnswer = options[2];
        } else if (upper === "D" || upper === "3") {
          correctAnswer = options[3];
        }
      }

      cleanQuestions.push({
        options,
        question_id: questionId,
        question_text: q.question_text.trim(),
        ...(q.difficulty === undefined ? {} : { difficulty: q.difficulty }),
      });

      answerKey.push({
        correct_answer: correctAnswer,
        explanation: q.explanation.trim(),
        question_id: questionId,
      });
    }

    return { answerKey, questions: cleanQuestions };
  }

  private async generateAiFeedback(
    score: number,
    maxScore: number,
    detailedResult: readonly ExamAttemptDetailItem[],
  ): Promise<string> {
    try {
      const wrongItems = detailedResult.filter((r) => !r.is_correct);
      const wrongSummary =
        wrongItems.length > 0
          ? wrongItems
              .map(
                (w) =>
                  `- Q: "${w.question_text}" (User answered: ${w.selected_answer}; Correct: ${w.correct_answer}). Reason: ${w.explanation}`,
              )
              .join("\n")
          : "None! Perfect score!";

      const prompt = `The student completed an assessment and scored ${score} out of ${maxScore}.\n\nIncorrect questions:\n${wrongSummary}\n\nProvide 3-4 sentences of encouraging, personalized pedagogical feedback pointing out key concepts they mastered and specific topics they should review based on the missed questions.`;

      const result = await this.llmProvider.generateText({
        messages: [{ content: prompt, role: "user" }],
        systemPrompt: "You are a supportive, insightful educational AI tutor.",
        temperature: 0.4,
      });

      if (result && result.text.trim()) {
        return result.text.trim();
      }
    } catch {
      // Fallback if LLM fails
    }

    if (score === maxScore) {
      return `Outstanding performance! You achieved a perfect score of ${score}/${maxScore}. You have demonstrated excellent mastery of the concepts.`;
    }
    return `You scored ${score}/${maxScore}. Please review the detailed explanations for the questions you missed to strengthen your understanding of those concepts.`;
  }
}
