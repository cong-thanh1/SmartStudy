export type QuizDifficulty = "easy" | "hard" | "medium";

export interface QuizQuestion {
  readonly correct_answer: string;
  readonly explanation: string;
  readonly options: readonly string[];
  readonly question_id: string;
  readonly question_text: string;
}

export interface QuizRecord {
  readonly createdAt: Date;
  readonly difficulty: QuizDifficulty | null;
  readonly documentId: string;
  readonly id: string;
  readonly questions: readonly QuizQuestion[];
  readonly userId: string;
}

export interface SaveQuizInput {
  readonly difficulty?: QuizDifficulty | null;
  readonly documentId: string;
  readonly questions: readonly QuizQuestion[];
  readonly userId: string;
}

export interface IQuizRepository {
  findOwnedById(id: string, userId: string): Promise<QuizRecord | null>;
  listOwnedByDocument(documentId: string, userId: string): Promise<readonly QuizRecord[]>;
  save(input: SaveQuizInput): Promise<QuizRecord>;
}
