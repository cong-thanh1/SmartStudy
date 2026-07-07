export type QuizErrorCode =
  | "QUIZ_DOCUMENT_NOT_FOUND"
  | "QUIZ_DOCUMENT_NOT_READY"
  | "QUIZ_GENERATION_ERROR"
  | "QUIZ_NOT_FOUND";

export class QuizError extends Error {
  constructor(
    readonly code: QuizErrorCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "QuizError";
  }
}

export class QuizDocumentNotFoundError extends QuizError {
  constructor(documentId: string) {
    super(
      "QUIZ_DOCUMENT_NOT_FOUND",
      404,
      `Document not found or not owned by user: ${documentId}`,
    );
    this.name = "QuizDocumentNotFoundError";
  }
}

export class QuizDocumentNotReadyError extends QuizError {
  constructor(documentId: string, status: string) {
    super(
      "QUIZ_DOCUMENT_NOT_READY",
      409,
      `Document is not ready for quiz generation: ${documentId} (status: ${status})`,
    );
    this.name = "QuizDocumentNotReadyError";
  }
}

export class QuizNotFoundError extends QuizError {
  constructor(quizId: string) {
    super("QUIZ_NOT_FOUND", 404, `Quiz not found: ${quizId}`);
    this.name = "QuizNotFoundError";
  }
}

export class QuizGenerationError extends QuizError {
  constructor(message: string) {
    super(
      "QUIZ_GENERATION_ERROR",
      502,
      `Failed to generate quiz: ${message}`,
    );
    this.name = "QuizGenerationError";
  }
}
