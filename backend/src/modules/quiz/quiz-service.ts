import type { ILLMProvider } from "../../ports/index.js";
import type { IDocumentRepository } from "../documents/document-repository.js";
import {
  loadQuizGenerationConfig,
  type QuizGenerationConfig,
} from "./quiz-config.js";
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
    private readonly config: QuizGenerationConfig = loadQuizGenerationConfig(),
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

    const numQuestions = input.numQuestions ?? 5;
    const difficultyText = input.difficulty
      ? `Difficulty level: ${input.difficulty}.`
      : "Moderate difficulty.";
    const chapterText = input.chapterRef
      ? `Focus specifically on chapter "${input.chapterRef}".`
      : "Cover the key concepts of the document.";

    const systemPrompt = `You are an expert educational assessment creator. Generate one multiple-choice question based on the provided study material. ${difficultyText} ${chapterText} Questions may cover the same topic or learning objective when they test it from a genuinely different angle. Do not repeat an earlier question with an equivalent correct answer. Write every question, option, answer, and explanation only in Vietnamese or English; never use Chinese, Japanese, Korean, or another writing system. The question MUST have exactly 4 distinct options, 1 correct answer matching one option exactly, and a concise explanation. Return ONLY a JSON object matching the requested schema without markdown formatting or commentary.`;
    const generatedQuestions: GeneratedQuizQuestion[] = [];
    let lastFailure = "Unknown error during question generation.";
    const slotBudget = numQuestions * this.config.topUpSlotMultiplier;

    // Small CPU-only models are much more reliable when grammar-constrained
    // output contains one question, rather than a long array that can exhaust
    // the context window halfway through JSON generation.
    for (
      let slotIndex = 0;
      generatedQuestions.length < numQuestions && slotIndex < slotBudget;
      slotIndex++
    ) {
      const earlierQuestions = generatedQuestions
        .slice(-10)
        .map((question) => `- ${question.question_text}`)
        .join("\n");
      const result = await this.generateOneQuestion(
        chunks,
        slotIndex,
        numQuestions,
        `${systemPrompt}\nThis is question ${generatedQuestions.length + 1} of ${numQuestions}.` +
          (earlierQuestions
            ? `\nRecent question stems that must not be repeated with the same answer:\n${earlierQuestions}`
            : ""),
        generatedQuestions,
      );
      if (result.question) {
        generatedQuestions.push({
          ...result.question,
          question_id: `q-${generatedQuestions.length + 1}`,
        });
      } else {
        lastFailure = result.message ?? lastFailure;
        if (result.reason === "MODEL_ERROR") break;
      }
    }

    const validQuestions = this.normalizeAndValidateQuestions(generatedQuestions);
    if (validQuestions.length === 0) {
      throw new QuizGenerationError(
        `No valid quiz questions could be generated. Last error: ${lastFailure}`,
      );
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
    chunks: readonly { readonly chunkText: string }[],
    slotIndex: number,
    numQuestions: number,
    systemPrompt: string,
    earlierQuestions: readonly GeneratedQuizQuestion[],
  ): Promise<QuestionGenerationResult> {
    let lastError = "Unknown error during question generation.";
    let lastReason: QuestionGenerationFailureReason = "INVALID_MODEL_OUTPUT";

    for (let attempt = 0; attempt < this.config.attemptsPerSlot; attempt++) {
      try {
        const sourceText = selectQuestionSource(
          chunks,
          slotIndex + attempt,
          numQuestions,
        );
        const rawResult = await this.llmProvider.generateStructuredJSON<unknown>({
          messages: [{ content: sourceText, role: "user" }],
          maxTokens: 320,
          schemaDescription: JSON.stringify(questionSetJsonSchema(1, false)),
          systemPrompt: `${systemPrompt}\n${retryInstruction(attempt)}`,
          temperature: Math.min(0.6 + attempt * 0.06, 0.84),
        });
        const parsed = generatedQuizSchema.safeParse(normalizeQuestionSet(rawResult));
        const parsedQuestion = parsed.success ? parsed.data.questions[0] : undefined;
        const question = parsedQuestion
          ? normalizeGeneratedQuestion(parsedQuestion)
          : undefined;
        if (!question) {
          lastReason = "INVALID_MODEL_OUTPUT";
          lastError = parsed.success
            ? "LLM returned a correct answer that does not match any option."
            : parsed.error.message;
          continue;
        }
        if (!isDuplicateQuestion(question, earlierQuestions, this.config)) {
          return { question };
        }
        lastReason = "DUPLICATE_QUESTION";
        lastError = "LLM returned a duplicate question and answer.";
      } catch (error) {
        lastReason = "MODEL_ERROR";
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return { message: lastError, reason: lastReason };
  }
}

type QuestionGenerationFailureReason =
  | "DUPLICATE_QUESTION"
  | "INVALID_MODEL_OUTPUT"
  | "MODEL_ERROR";

interface QuestionGenerationResult {
  readonly message?: string;
  readonly question?: GeneratedQuizQuestion;
  readonly reason?: QuestionGenerationFailureReason;
}

function selectQuestionSource(
  chunks: readonly { readonly chunkText: string }[],
  questionIndex: number,
  numQuestions: number,
): string {
  const normalizedIndex = questionIndex % Math.max(numQuestions, 1);
  const start = Math.floor((normalizedIndex * chunks.length) / numQuestions);
  return chunks
    .slice(start, Math.min(start + 2, chunks.length))
    .map((chunk) => chunk.chunkText)
    .join("\n\n");
}

function isDuplicateQuestion(
  candidate: GeneratedQuizQuestion,
  earlierQuestions: readonly GeneratedQuizQuestion[],
  config: Pick<
    QuizGenerationConfig,
    "answerDuplicateThreshold" | "lexicalDuplicateThreshold"
  >,
): boolean {
  const candidateQuestion = normalizeComparableText(candidate.question_text);
  const candidateAnswer = normalizeComparableText(candidate.correct_answer);
  const candidateTokens = normalizedTokens(candidateQuestion);
  if (candidateTokens.size === 0) return true;

  return earlierQuestions.some((earlier) => {
    const earlierQuestion = normalizeComparableText(earlier.question_text);
    const earlierAnswer = normalizeComparableText(earlier.correct_answer);
    if (
      candidateQuestion === earlierQuestion &&
      candidateAnswer === earlierAnswer
    ) {
      return true;
    }

    const earlierTokens = normalizedTokens(earlierQuestion);
    if (earlierTokens.size === 0) return false;
    const questionSimilarity = jaccardSimilarity(candidateTokens, earlierTokens);
    const answerSimilarity = jaccardSimilarity(
      normalizedTokens(candidateAnswer),
      normalizedTokens(earlierAnswer),
    );
    return (
      questionSimilarity >= config.lexicalDuplicateThreshold &&
      answerSimilarity >= config.answerDuplicateThreshold
    );
  });
}

function jaccardSimilarity(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  const overlap = [...left].filter((token) => right.has(token)).length;
  return overlap / (left.size + right.size - overlap);
}

function normalizeComparableText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedTokens(value: string): Set<string> {
  return new Set(
    normalizeComparableText(value)
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

function normalizeGeneratedQuestion(
  question: GeneratedQuizQuestion,
): GeneratedQuizQuestion | undefined {
  const correctAnswer = question.correct_answer.trim();
  const exactMatch = question.options.find(
    (option) => option.toLocaleLowerCase() === correctAnswer.toLocaleLowerCase(),
  );
  if (exactMatch) return { ...question, correct_answer: exactMatch };

  const optionIndex = answerOptionIndex(correctAnswer);
  const matchedOption = optionIndex === undefined
    ? undefined
    : question.options[optionIndex];
  return matchedOption ? { ...question, correct_answer: matchedOption } : undefined;
}

function answerOptionIndex(answer: string): number | undefined {
  const normalized = answer.trim().toUpperCase();
  if (normalized === "A" || normalized === "0" || normalized.startsWith("A)")) return 0;
  if (normalized === "B" || normalized === "1" || normalized.startsWith("B)")) return 1;
  if (normalized === "C" || normalized === "2" || normalized.startsWith("C)")) return 2;
  if (normalized === "D" || normalized === "3" || normalized.startsWith("D)")) return 3;
  return undefined;
}

function retryInstruction(attempt: number): string {
  const instructions = [
    "Generation strategy: ask directly about a specific supported fact.",
    "Retry strategy: use a different question angle and paraphrase the task.",
    "Retry strategy: test application or cause-and-effect using another source span.",
    "Retry strategy: use a comparison, exception, or short scenario.",
    "Final strategy: deterministically ask about one explicit fact from SOURCE using concise wording.",
  ] as const;
  return instructions[Math.min(attempt, instructions.length - 1)] ?? instructions[0];
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
