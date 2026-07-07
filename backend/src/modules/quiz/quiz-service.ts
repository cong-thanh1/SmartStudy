import type { ILLMProvider } from "../../ports/index.js";
import type { IDocumentRepository } from "../documents/document-repository.js";
import {
  QuizDocumentNotFoundError,
  QuizDocumentNotReadyError,
  QuizGenerationError,
  QuizNotFoundError,
} from "./quiz-errors.js";
import type {
  IQuizRepository,
  QuizDifficulty,
  QuizQuestion,
  QuizRecord,
} from "./quiz-repository.js";
import {
  generatedQuizSchema,
  type GeneratedQuizQuestion,
} from "./quiz-schemas.js";

export interface GenerateQuizInput {
  readonly chapterRef?: string;
  readonly difficulty?: QuizDifficulty;
  readonly documentId: string;
  readonly numQuestions?: number;
  readonly userId: string;
}

export interface GetQuizInput {
  readonly quizId: string;
  readonly userId: string;
}

export interface ListQuizzesInput {
  readonly documentId: string;
  readonly userId: string;
}

export interface IQuizService {
  generateQuiz(input: GenerateQuizInput): Promise<QuizRecord>;
  getQuiz(input: GetQuizInput): Promise<QuizRecord>;
  listQuizzes(input: ListQuizzesInput): Promise<readonly QuizRecord[]>;
}

export class QuizService implements IQuizService {
  constructor(
    private readonly quizRepository: IQuizRepository,
    private readonly documentRepository: IDocumentRepository,
    private readonly llmProvider: ILLMProvider,
  ) {}

  async generateQuiz(input: GenerateQuizInput): Promise<QuizRecord> {
    const document = await this.documentRepository.findOwnedById(
      input.documentId,
      input.userId,
    );
    if (!document) {
      throw new QuizDocumentNotFoundError(input.documentId);
    }
    if (document.status !== "ready") {
      throw new QuizDocumentNotReadyError(input.documentId, document.status);
    }

    const chunks = await this.documentRepository.listChunks(
      input.documentId,
      input.userId,
      input.chapterRef,
    );
    if (chunks.length === 0) {
      throw new QuizGenerationError(
        "No document content available to generate quiz.",
      );
    }

    const sourceText = chunks
      .slice(0, 15)
      .map((c) => c.chunkText)
      .join("\n\n");
    const numQuestions = input.numQuestions ?? 5;
    const difficultyText = input.difficulty
      ? `Difficulty level: ${input.difficulty}.`
      : "Moderate difficulty.";
    const chapterText = input.chapterRef
      ? `Focus specifically on chapter "${input.chapterRef}".`
      : "Cover the key concepts of the document.";

    const systemPrompt = `You are an expert educational assessment creator. Generate exactly ${numQuestions} multiple-choice questions based on the provided study material. ${difficultyText} ${chapterText} Each question MUST have exactly 4 options, 1 correct answer (must exactly match one of the 4 options or be option letter A, B, C, or D), and a clear pedagogical explanation. Return ONLY a JSON object matching the requested schema without markdown formatting or commentary.`;
    const schemaDescription =
      "An object with property 'questions' which is an array of objects containing question_id (string), question_text (string), options (array of 4 strings), correct_answer (string matching one of options or A/B/C/D), and explanation (string).";

    const maxAttempts = 3;
    let lastError = "Unknown error during quiz generation.";

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

        const parsed = generatedQuizSchema.safeParse(rawResult);
        if (!parsed.success) {
          lastError = `Zod schema validation failed: ${parsed.error.message}`;
          continue;
        }

        const validQuestions = this.normalizeAndValidateQuestions(
          parsed.data.questions,
        );
        if (validQuestions.length === 0) {
          lastError = "No valid questions after answer normalization.";
          continue;
        }

        return await this.quizRepository.save({
          difficulty: input.difficulty ?? null,
          documentId: input.documentId,
          questions: validQuestions,
          userId: input.userId,
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new QuizGenerationError(
      `Failed to generate valid quiz after ${maxAttempts} attempts. Last error: ${lastError}`,
    );
  }

  async getQuiz(input: GetQuizInput): Promise<QuizRecord> {
    const quiz = await this.quizRepository.findOwnedById(
      input.quizId,
      input.userId,
    );
    if (!quiz) {
      throw new QuizNotFoundError(input.quizId);
    }
    return quiz;
  }

  async listQuizzes(input: ListQuizzesInput): Promise<readonly QuizRecord[]> {
    const document = await this.documentRepository.findOwnedById(
      input.documentId,
      input.userId,
    );
    if (!document) {
      throw new QuizDocumentNotFoundError(input.documentId);
    }
    return this.quizRepository.listOwnedByDocument(
      input.documentId,
      input.userId,
    );
  }

  private normalizeAndValidateQuestions(
    questions: readonly GeneratedQuizQuestion[],
  ): readonly QuizQuestion[] {
    const valid: QuizQuestion[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q || q.options.length !== 4) {
        continue;
      }

      const options = [
        q.options[0] ?? "",
        q.options[1] ?? "",
        q.options[2] ?? "",
        q.options[3] ?? "",
      ] as const;

      let correctAnswer = q.correct_answer.trim();

      const exactMatchIndex = options.findIndex(
        (opt) => opt.toLowerCase() === correctAnswer.toLowerCase(),
      );
      if (exactMatchIndex !== -1) {
        correctAnswer = options[exactMatchIndex] ?? correctAnswer;
      } else {
        const upper = correctAnswer.toUpperCase();
        if (upper === "A" || upper === "0" || upper.startsWith("A)")) {
          correctAnswer = options[0];
        } else if (upper === "B" || upper === "1" || upper.startsWith("B)")) {
          correctAnswer = options[1];
        } else if (upper === "C" || upper === "2" || upper.startsWith("C)")) {
          correctAnswer = options[2];
        } else if (upper === "D" || upper === "3" || upper.startsWith("D)")) {
          correctAnswer = options[3];
        } else {
          continue; // Cannot determine correct answer clearly
        }
      }

      valid.push({
        correct_answer: correctAnswer,
        explanation: q.explanation.trim(),
        options,
        question_id: q.question_id.trim() || `q-${i + 1}`,
        question_text: q.question_text.trim(),
      });
    }

    return valid;
  }
}
