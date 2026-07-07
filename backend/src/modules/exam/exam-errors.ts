export type ExamErrorCode =
  | "EXAM_ATTEMPT_NOT_FOUND"
  | "EXAM_DOCUMENT_NOT_FOUND"
  | "EXAM_DOCUMENT_NOT_READY"
  | "EXAM_GENERATION_ERROR"
  | "EXAM_NOT_FOUND";

export class ExamError extends Error {
  constructor(
    readonly code: ExamErrorCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ExamError";
  }
}

export class ExamDocumentNotFoundError extends ExamError {
  constructor(documentId: string) {
    super(
      "EXAM_DOCUMENT_NOT_FOUND",
      404,
      `Document not found or not owned by user: ${documentId}`,
    );
    this.name = "ExamDocumentNotFoundError";
  }
}

export class ExamDocumentNotReadyError extends ExamError {
  constructor(documentId: string, status: string) {
    super(
      "EXAM_DOCUMENT_NOT_READY",
      409,
      `Document is not ready for exam generation: ${documentId} (status: ${status})`,
    );
    this.name = "ExamDocumentNotReadyError";
  }
}

export class ExamNotFoundError extends ExamError {
  constructor(examId: string) {
    super("EXAM_NOT_FOUND", 404, `Exam not found: ${examId}`);
    this.name = "ExamNotFoundError";
  }
}

export class ExamAttemptNotFoundError extends ExamError {
  constructor(attemptId: string) {
    super("EXAM_ATTEMPT_NOT_FOUND", 404, `Exam attempt not found: ${attemptId}`);
    this.name = "ExamAttemptNotFoundError";
  }
}

export class ExamGenerationError extends ExamError {
  constructor(message: string) {
    super(
      "EXAM_GENERATION_ERROR",
      502,
      `Failed to generate exam: ${message}`,
    );
    this.name = "ExamGenerationError";
  }
}
