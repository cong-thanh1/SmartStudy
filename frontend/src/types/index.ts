// Core User and Authentication Types
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Document Management Types
export type DocumentStatus = 'PROCESSING' | 'READY' | 'FAILED';

export interface Document {
  id: string;
  userId: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  chunkCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  documentId: string;
  objectKey: string;
}

// RAG Chat & Conversation Types
export interface Citation {
  documentId: string;
  chunkId: string;
  pageNumber?: number;
  snippet: string;
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
  id: string;
  documentId: string;
  type: SummaryType;
  chapterIndex?: number;
  chapterTitle?: string;
  content: string;
  createdAt: string;
}

// Interactive Quiz Types
export interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
}

export interface Quiz {
  id: string;
  documentId: string;
  title: string;
  chapterIndex?: number;
  questions: QuizQuestion[];
  createdAt: string;
}

// Exam & AI Grading Types
export interface ExamQuestion {
  id: string;
  questionText: string;
  options: string[];
  points: number;
}

export interface Exam {
  id: string;
  title: string;
  documentId?: string;
  durationMinutes: number;
  totalPoints: number;
  questions: ExamQuestion[];
  createdAt: string;
}

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

export interface ExamAttempt {
  id: string;
  examId: string;
  userId: string;
  score?: number;
  answers: Record<string, number>;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  submittedAt?: string;
  result?: GradingResult;
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
