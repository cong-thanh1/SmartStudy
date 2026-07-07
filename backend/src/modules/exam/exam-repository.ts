export type ExamDifficulty = "easy" | "hard" | "medium";

export interface ExamQuestion {
  readonly difficulty?: ExamDifficulty;
  readonly options: readonly string[];
  readonly question_id: string;
  readonly question_text: string;
}

export interface ExamAnswerKeyItem {
  readonly correct_answer: string;
  readonly explanation: string;
  readonly question_id: string;
}

export interface ExamRecord {
  readonly answerKey?: readonly ExamAnswerKeyItem[];
  readonly createdAt: Date;
  readonly difficultyDistribution: Record<string, number> | null;
  readonly documentId: string;
  readonly id: string;
  readonly numQuestions: number;
  readonly questions: readonly ExamQuestion[];
  readonly timeLimitMinutes: number | null;
  readonly userId: string;
}

export interface ExamAttemptDetailItem {
  readonly correct_answer: string;
  readonly explanation: string;
  readonly is_correct: boolean;
  readonly question_id: string;
  readonly question_text: string;
  readonly selected_answer: string;
}

export interface ExamAttemptAnswer {
  readonly question_id: string;
  readonly selected_answer: string;
}

export interface ExamAttemptRecord {
  readonly aiFeedback: string | null;
  readonly answers: readonly ExamAttemptAnswer[];
  readonly detailedResult: readonly ExamAttemptDetailItem[] | null;
  readonly examId: string | null;
  readonly id: string;
  readonly maxScore: number | null;
  readonly quizId: string | null;
  readonly score: number | null;
  readonly submittedAt: Date;
  readonly userId: string;
}

export interface SaveExamInput {
  readonly answerKey: readonly ExamAnswerKeyItem[];
  readonly difficultyDistribution?: Record<string, number> | null;
  readonly documentId: string;
  readonly numQuestions: number;
  readonly questions: readonly ExamQuestion[];
  readonly timeLimitMinutes?: number | null;
  readonly userId: string;
}

export interface SaveExamAttemptInput {
  readonly aiFeedback?: string | null;
  readonly answers: readonly ExamAttemptAnswer[];
  readonly detailedResult: readonly ExamAttemptDetailItem[];
  readonly examId?: string | null;
  readonly maxScore: number;
  readonly quizId?: string | null;
  readonly score: number;
  readonly userId: string;
}

export interface IExamRepository {
  findAttemptById(id: string, userId: string): Promise<ExamAttemptRecord | null>;
  findOwnedById(id: string, userId: string): Promise<ExamRecord | null>;
  listAttemptsByExam(
    examId: string,
    userId: string,
  ): Promise<readonly ExamAttemptRecord[]>;
  listOwnedByDocument(
    documentId: string,
    userId: string,
  ): Promise<readonly ExamRecord[]>;
  save(input: SaveExamInput): Promise<ExamRecord>;
  saveAttempt(input: SaveExamAttemptInput): Promise<ExamAttemptRecord>;
}
