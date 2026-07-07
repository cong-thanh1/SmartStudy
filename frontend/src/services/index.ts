import { api, setTokens, setStoredUser, clearAuth } from './api';
export * from './api';
import {
  AuthResponse,
  Document,
  PresignedUploadResponse,
  Conversation,
  Message,
  Summary,
  SummaryType,
  Quiz,
  Exam,
  ExamAttempt,
  TutorRequest,
  TutorResponse,
} from '../types';

// ==========================================
// Phase 0: Auth Service
// ==========================================
export const authService = {
  async login(email: string, password?: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', { email, password: password || '12345678' });
    setTokens(response.data.accessToken, response.data.refreshToken);
    setStoredUser(response.data.user);
    return response.data;
  },

  async register(email: string, password: string = '12345678', name?: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', { email, password, name });
    setTokens(response.data.accessToken, response.data.refreshToken);
    setStoredUser(response.data.user);
    return response.data;
  },

  logout() {
    clearAuth();
  },
};

// ==========================================
// Phase 1: Documents Service
// ==========================================
export const documentService = {
  async listDocuments(): Promise<Document[]> {
    const response = await api.get<{ documents: Document[] }>('/documents');
    return response.data.documents || [];
  },

  async uploadDocument(file: File, title?: string): Promise<Document> {
    const docTitle = title || file.name.replace(/\.[^/.]+$/, '');
    // Step 1: Get presigned upload URL
    const presignedResp = await api.post<PresignedUploadResponse>('/documents/upload-url', {
      title: docTitle,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    // Step 2: Upload directly to storage provider (MinIO/S3)
    await fetch(presignedResp.data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    // Step 3: Complete upload trigger
    const completeResp = await api.post<Document>(`/documents/${presignedResp.data.documentId}/complete`);
    return completeResp.data;
  },

  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },
};

// ==========================================
// Phase 1: RAG Chat Service
// ==========================================
export const chatService = {
  async listConversations(documentId?: string): Promise<Conversation[]> {
    const url = documentId ? `/chat/conversations?documentId=${documentId}` : '/chat/conversations';
    const response = await api.get<{ conversations: Conversation[] }>(url);
    return response.data.conversations || [];
  },

  async createConversation(title: string, documentId?: string): Promise<Conversation> {
    const response = await api.post<{ conversation: Conversation }>('/chat/conversations', { title, documentId });
    return response.data.conversation || response.data;
  },

  async sendMessage(conversationId: string, content: string): Promise<Message> {
    const response = await api.post<any>(`/chat/conversations/${conversationId}/messages`, { content });
    return response.data.assistantMessage || response.data;
  },
};

// ==========================================
// Phase 2: Summaries Service
// ==========================================
export const summaryService = {
  async getSummary(documentId: string, type: SummaryType = 'FULL', chapterIndex?: number): Promise<Summary> {
    const url = `/summaries?documentId=${documentId}&type=${type}${chapterIndex !== undefined ? `&chapterIndex=${chapterIndex}` : ''}`;
    const response = await api.get<Summary>(url);
    return response.data;
  },
};

// ==========================================
// Phase 2: Quiz Service
// ==========================================
export const quizService = {
  async generateQuiz(documentId: string, title?: string, numQuestions: number = 5): Promise<Quiz> {
    const response = await api.post<Quiz>('/quizzes/generate', { documentId, title, numQuestions });
    return response.data;
  },
};

// ==========================================
// Phase 3: Exam & Grading Service
// ==========================================
export const examService = {
  async generateExam(title: string, documentId: string, numQuestions: number = 10, durationMinutes: number = 15): Promise<Exam> {
    const response = await api.post<Exam>('/exams/generate', { title, documentId, numQuestions, durationMinutes });
    return response.data;
  },

  async submitAttempt(examId: string, answers: Record<string, number>): Promise<ExamAttempt> {
    const response = await api.post<ExamAttempt>(`/grading/exams/${examId}/submit`, { answers });
    return response.data;
  },
};

// ==========================================
// Phase 4: Tutor Service
// ==========================================
export const tutorService = {
  async askTutor(request: TutorRequest): Promise<TutorResponse> {
    const response = await api.post<TutorResponse>('/tutor/ask', request);
    return response.data;
  },
};
