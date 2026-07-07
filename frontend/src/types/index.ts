// Core User and Authentication Types
export interface User {
  id: string;
  email: string;
  fullName?: string;
  name?: string;
  createdAt: string;
}

export interface AuthResponse {
  // Backend returns AuthSession: { tokens: AuthTokens, user: AuthUser }
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
  };
  user: User;
  // Legacy fields (for backwards compatibility)
  accessToken?: string;
  refreshToken?: string;
}

// Document Management Types
export type DocumentStatus = 'processing' | 'ready' | 'failed' | 'uploading';

export interface Document {
  id: string;
  userId: string;
  title: string;
  status: DocumentStatus;
  chunkCount?: number;
  createdAt: string;
  updatedAt?: string;
  // Optional fields that may or may not be returned
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface PresignedUploadResponse {
  // Backend DocumentUploadResult shape: { document: DocumentSummary, upload: PresignedUpload }
  document: {
    id: string;
    title: string;
    status: DocumentStatus;
    sizeBytes?: number | null;
    createdAt: Date | string;
  };
  upload: {
    url: string;
    method: 'PUT';
    headers?: Record<string, string>;
    expiresAt?: Date | string;
  };
}

// RAG Chat & Conversation Types
export interface Citation {
  documentId: string;
  chunkId?: string;
  pageNumber?: number;
  snippet: string;
  chunkIndex?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  documentId?: string;
  createdAt: string;
  updatedAt?: string;
  messages?: Message[];
}

// Summarization Types
export type SummaryType = 'FULL' | 'CHAPTER';

export interface Summary {
  id?: string;
  documentId: string;
  type?: SummaryType;
  scope?: 'full' | 'chapter';
  chapterRef?: string | null;
  chapterIndex?: number;
  chapterTitle?: string;
  content?: string;       // legacy field
  summary?: string;       // legacy field
  summaryText?: string;   // backend field: SummaryRecord.summaryText
  keyPoints?: readonly string[];  // backend field: SummaryRecord.keyPoints
  createdAt?: string;
}

// Interactive Quiz Types — matches backend quiz-schemas
export interface QuizQuestion {
  question_id: string;
  question_text: string;
  options: readonly string[];
  correct_answer?: string; // Only present after submitting (in review mode)
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  // Legacy frontend-only fields (for compatibility)
  id?: string;
  questionText?: string;
  correctOptionIndex?: number;
}

export interface Quiz {
  id: string;
  documentId: string;
  title?: string;
  questions: QuizQuestion[];
  createdAt: string;
}

// Exam & AI Grading Types — matches backend exam-repository
export interface ExamQuestion {
  question_id: string;
  question_text: string;
  options: readonly string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  // No correctOptionIndex or correct_answer in take mode (security)
  // Legacy frontend-only fields
  id?: string;
  questionText?: string;
  points?: number;
}

export interface Exam {
  id: string;
  documentId: string;
  numQuestions: number;
  timeLimitMinutes?: number | null;
  questions: ExamQuestion[];
  createdAt: Date | string;
  // Legacy frontend fields
  title?: string;
  durationMinutes?: number;
  totalPoints?: number;
}

// Attempt result types from backend
export interface ExamAttemptDetail {
  question_id: string;
  question_text: string;
  selected_answer: string;
  correct_answer: string;
  explanation: string;
  is_correct: boolean;
}

export interface ExamAttempt {
  id: string;
  examId?: string | null;
  quizId?: string | null;
  userId: string;
  score: number | null;
  maxScore: number | null;
  aiFeedback: string | null;
  detailedResult: readonly ExamAttemptDetail[] | null;
  answers: readonly { question_id: string; selected_answer: string }[];
  submittedAt: Date | string;
  // Legacy types (for backwards compatibility)
  status?: string;
  result?: GradingResult;
}

// Legacy types for ResultsPage compatibility
export interface QuestionGradingDetail {
  questionId: string;
  userOption: number;
  correctOption: number;
  isCorrect: boolean;
  explanationForWrong?: string;
}

export interface GradingResult {
  attemptId: string;
  score: number;
  totalPoints: number;
  details: QuestionGradingDetail[];
  aiFeedback?: string;
}

// AI Tutor Types
export interface TutorRequest {
  question: string;
  documentId?: string;
  chapterIndex?: number;
  contextSnippet?: string;
}

export interface TutorResponse {
  answer: string;
  suggestedQuestions?: string[];
  relatedTopics?: string[];
}
