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

    const chunks = await this.documentRepository.listChunks({
      documentId: input.documentId,
      userId: input.userId,
      ...(input.chapterRef === undefined
        ? {}
        : { chapterTitle: input.chapterRef }),
    });
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

    const systemPrompt = `You are an expert educational assessment creator. Generate one multiple-choice question based on the provided study material. ${difficultyText} ${chapterText} The question MUST have exactly 4 distinct options, 1 correct answer matching one option exactly, and a concise explanation. Return ONLY a JSON object matching the requested schema without markdown formatting or commentary.`;
    const generatedQuestions: GeneratedQuizQuestion[] = [];

    // Small CPU-only models are much more reliable when grammar-constrained
    // output contains one question, rather than a long array that can exhaust
    // the context window halfway through JSON generation.
    for (let index = 0; index < numQuestions; index++) {
      const generated = await this.generateOneQuestion(
        sourceText,
        `${systemPrompt}\nThis is question ${index + 1} of ${numQuestions}.`,
      );
      generatedQuestions.push({
        ...generated,
        question_id: `q-${index + 1}`,
      });
    }

    const validQuestions = this.normalizeAndValidateQuestions(generatedQuestions);
    if (validQuestions.length !== numQuestions) {
      throw new QuizGenerationError("A generated quiz contained an invalid question.");
    }

    return this.quizRepository.save({
      difficulty: input.difficulty ?? null,
      documentId: input.documentId,
      questions: validQuestions,
      userId: input.userId,
    });
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

  private async generateOneQuestion(
    sourceText: string,
    systemPrompt: string,
  ): Promise<GeneratedQuizQuestion> {
    let lastError = "Unknown error during question generation.";

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const rawResult = await this.llmProvider.generateStructuredJSON<unknown>({
          messages: [{ content: sourceText, role: "user" }],
          maxTokens: 320,
          schemaDescription: JSON.stringify(questionSetJsonSchema(1, false)),
          systemPrompt,
          // A retry must not repeat the same deterministic low-temperature
          // decoding path; otherwise a malformed local-model answer is
          // reproduced three times and generation always fails.
          temperature: 0.2 + attempt * 0.15,
        });
        const parsed = generatedQuizSchema.safeParse(normalizeQuestionSet(rawResult));
        const question = parsed.success ? parsed.data.questions[0] : undefined;
        if (question) return question;
        lastError = parsed.success ? "LLM returned no question." : parsed.error.message;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new QuizGenerationError(
      `Failed to generate a valid quiz question. Last error: ${lastError}`,
    );
  }
}

function normalizeQuestionSet(raw: unknown): unknown {
  if (!isRecord(raw) || Array.isArray(raw.questions)) return raw;
  return {
    questions: [{
      correct_answer: raw.correct_answer ?? raw.answer,
      explanation: raw.explanation,
      options: raw.options,
      question_id: raw.question_id ?? "generated-question",
      question_text: raw.question_text ?? raw.question,
    }],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function questionSetJsonSchema(
  numQuestions: number,
  includeDifficulty: boolean,
): Record<string, unknown> {
  const questionProperties: Record<string, unknown> = {
    correct_answer: { type: "string" },
    explanation: { type: "string" },
    options: {
      items: { type: "string" },
      maxItems: 4,
      minItems: 4,
      type: "array",
    },
    question_id: { type: "string" },
    question_text: { type: "string" },
  };

  if (includeDifficulty) {
    questionProperties.difficulty = {
      enum: ["easy", "medium", "hard"],
      type: "string",
    };
  }

  return {
    additionalProperties: false,
    properties: {
      questions: {
        items: {
          additionalProperties: false,
          properties: questionProperties,
          required: Object.keys(questionProperties),
          type: "object",
        },
        maxItems: numQuestions,
        minItems: numQuestions,
        type: "array",
      },
    },
    required: ["questions"],
    type: "object",
  };
}
