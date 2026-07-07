import { api, setTokens, setStoredUser, clearAuth, getRefreshToken } from './api';
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
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    setStoredUser(response.data.user);
    return response.data;
  },

  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', { email, password, ...(name ? { fullName: name } : {}) });
    setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    setStoredUser(response.data.user);
    return response.data;
  },

  async logout() {
    const refreshToken = getRefreshToken();

    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } finally {
      clearAuth();
    }
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
    const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB - must match backend config
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File quá lớn. Giới hạn tối đa là 50MB. File của bạn: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
    }
    if (file.type !== 'application/pdf') {
      throw new Error('Chỉ chấp nhận file PDF (application/pdf).');
    }
    const docTitle = title || file.name.replace(/\.[^/.]+$/, '');
    // Step 1: Get presigned upload URL
    const presignedResp = await api.post<PresignedUploadResponse>('/documents/upload-url', {
      title: docTitle,
      contentType: file.type, // Backend expects 'contentType', not 'mimeType'
      sizeBytes: file.size,
    });

    // Step 2: Upload directly to storage provider (MinIO/S3)
    const uploadHeaders: Record<string, string> = {
      'Content-Type': file.type,
      ...(presignedResp.data.upload.headers || {}),
    };
    const uploadResp = await fetch(presignedResp.data.upload.url, {
      method: 'PUT',
      body: file,
      headers: uploadHeaders,
    });
    if (!uploadResp.ok) {
      throw new Error(`Tải lên lưu trữ thất bại: ${uploadResp.status} ${uploadResp.statusText}`);
    }

    // Step 3: Complete upload trigger - backend returns { document: Document }
    const completeResp = await api.post<{ document: Document }>(`/documents/${presignedResp.data.document.id}/complete`, {});
    return completeResp.data.document;
  },

  async getDocument(id: string): Promise<Document> {
    const response = await api.get<{ document: Document }>(`/documents/${id}`);
    return response.data.document;
  },

  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },
};

// ==========================================
// Phase 1: RAG Chat Service
// ==========================================
export const chatService = {
  async listConversations(_documentId?: string): Promise<Conversation[]> {
    // NOTE: Backend currently only supports POST /chat/conversations and POST /chat/conversations/:id/messages
    // GET /chat/conversations is not implemented — return empty array gracefully
    return [];
  },

  async createConversation(title: string, documentId?: string): Promise<Conversation> {
    // Backend requires documentId as UUID
    if (!documentId) throw new Error('documentId is required to create a conversation');
    const response = await api.post<{ conversation: Conversation }>('/chat/conversations', { title, documentId });
    return response.data.conversation;
  },

  async sendMessage(conversationId: string, content: string): Promise<Message> {
    const response = await api.post<{ assistantMessage?: Message; userMessage?: Message }>(
      `/chat/conversations/${conversationId}/messages`,
      { content }
    );
    return response.data.assistantMessage || (response.data as unknown as Message);
  },
};

// ==========================================
// Phase 2: Summaries Service
// ==========================================
export const summaryService = {
  // GET /documents/:documentId/summary?scope=full|chapter&chapterRef=...
  async getSummary(documentId: string, type: SummaryType = 'FULL', chapterRef?: string): Promise<Summary> {
    const scope = type === 'FULL' ? 'full' : 'chapter';
    const url = `/documents/${documentId}/summary?scope=${scope}${chapterRef ? `&chapterRef=${encodeURIComponent(chapterRef)}` : ''}`;
    const response = await api.get<{ summary: Summary }>(url);
    return response.data.summary;
  },

  // POST /documents/:documentId/summary to generate new summary
  async generateSummary(documentId: string, scope: 'full' | 'chapter' = 'full', chapterRef?: string, forceRefresh = false): Promise<Summary> {
    const body: { scope: string; forceRefresh: boolean; chapterRef?: string } = { scope, forceRefresh };
    if (chapterRef) body.chapterRef = chapterRef;
    const response = await api.post<{ summary: Summary }>(`/documents/${documentId}/summary`, body);
    return response.data.summary;
  },
};

// ==========================================
// Phase 2: Quiz Service
// ==========================================
export const quizService = {
  async generateQuiz(documentId: string, _title?: string, numQuestions: number = 5): Promise<Quiz> {
    const response = await api.post<{ quiz: Quiz }>(`/documents/${documentId}/quizzes`, { numQuestions });
    return response.data.quiz;
  },

  async listQuizzes(documentId: string): Promise<Quiz[]> {
    const response = await api.get<{ quizzes: Quiz[] }>(`/documents/${documentId}/quizzes`);
    return response.data.quizzes || [];
  },

  async getQuiz(quizId: string): Promise<Quiz> {
    const response = await api.get<{ quiz: Quiz }>(`/quizzes/${quizId}`);
    return response.data.quiz;
  },
};

// ==========================================
// Phase 3: Exam & Grading Service
// ==========================================
export const examService = {
  async generateExam(documentId: string, numQuestions: number = 10, timeLimitMinutes?: number): Promise<Exam> {
    const response = await api.post<{ exam: Exam }>(`/documents/${documentId}/exams`, { numQuestions, timeLimitMinutes });
    return response.data.exam;
  },

  async listExams(documentId: string): Promise<Exam[]> {
    const response = await api.get<{ exams: Exam[] }>(`/documents/${documentId}/exams`);
    return response.data.exams || [];
  },

  async getExam(examId: string, mode: 'take' | 'review' | 'grade' = 'take'): Promise<Exam> {
    const response = await api.get<{ exam: Exam }>(`/exams/${examId}?mode=${mode}`);
    return response.data.exam;
  },

  async submitAttempt(examId: string, answers: readonly { question_id: string; selected_answer: string }[]): Promise<ExamAttempt> {
    const response = await api.post<{ attempt: ExamAttempt }>(`/exams/${examId}/submit`, { answers });
    return response.data.attempt;
  },

  async submitQuizAttempt(quizId: string, answers: readonly { question_id: string; selected_answer: string }[]): Promise<ExamAttempt> {
    const response = await api.post<{ attempt: ExamAttempt }>(`/quizzes/${quizId}/submit`, { answers });
    return response.data.attempt;
  },

  async getAttempt(attemptId: string): Promise<ExamAttempt> {
    const response = await api.get<{ attempt: ExamAttempt }>(`/exam-attempts/${attemptId}`);
    return response.data.attempt;
  },

  async listAttempts(examId: string): Promise<ExamAttempt[]> {
    const response = await api.get<{ attempts: ExamAttempt[] }>(`/exams/${examId}/attempts`);
    return response.data.attempts || [];
  },
};

// ==========================================
// Phase 4: Tutor Service
// ==========================================
export const tutorService = {
  async askTutor(request: TutorRequest): Promise<TutorResponse> {
    // Backend strict schema: only 'question', 'documentId', 'history', 'topic' allowed
    const body: { question: string; documentId?: string; topic?: string } = {
      question: request.question,
    };
    if (request.documentId) body.documentId = request.documentId;
    // Note: chapterIndex and contextSnippet are not in the backend strict schema
    const response = await api.post<TutorResponse>('/tutor/ask', body);
    return response.data;
  },
};
