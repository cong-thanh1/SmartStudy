export type TutorErrorCode =
  | "TUTOR_DOCUMENT_NOT_FOUND"
  | "TUTOR_GENERATION_ERROR";

export class TutorError extends Error {
  constructor(
    readonly code: TutorErrorCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "TutorError";
  }
}

export class TutorDocumentNotFoundError extends TutorError {
  constructor(documentId: string) {
    super(
      "TUTOR_DOCUMENT_NOT_FOUND",
      404,
      `Document not found or not owned by user: ${documentId}`,
    );
    this.name = "TutorDocumentNotFoundError";
  }
}

export class TutorGenerationError extends TutorError {
  constructor(message: string) {
    super("TUTOR_GENERATION_ERROR", 502, `Tutor AI failed: ${message}`);
    this.name = "TutorGenerationError";
  }
}
