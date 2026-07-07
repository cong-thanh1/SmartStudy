export type SummaryErrorCode =
  | "SUMMARY_DOCUMENT_NOT_FOUND"
  | "SUMMARY_DOCUMENT_NOT_READY"
  | "SUMMARY_GENERATION_FAILED"
  | "SUMMARY_NOT_FOUND"
  | "SUMMARY_SOURCE_NOT_FOUND";

export class SummaryError extends Error {
  constructor(
    readonly code: SummaryErrorCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "SummaryError";
  }
}

export class SummaryDocumentNotFoundError extends SummaryError {
  constructor() {
    super("SUMMARY_DOCUMENT_NOT_FOUND", 404, "Document was not found");
    this.name = "SummaryDocumentNotFoundError";
  }
}

export class SummaryDocumentNotReadyError extends SummaryError {
  constructor() {
    super(
      "SUMMARY_DOCUMENT_NOT_READY",
      409,
      "Document must be ready before summarization",
    );
    this.name = "SummaryDocumentNotReadyError";
  }
}

export class SummaryNotFoundError extends SummaryError {
  constructor() {
    super("SUMMARY_NOT_FOUND", 404, "Summary was not found");
    this.name = "SummaryNotFoundError";
  }
}

export class SummarySourceNotFoundError extends SummaryError {
  constructor() {
    super(
      "SUMMARY_SOURCE_NOT_FOUND",
      409,
      "No extracted document text was found for summarization",
    );
    this.name = "SummarySourceNotFoundError";
  }
}

export class SummaryGenerationFailedError extends SummaryError {
  constructor(message = "LLM returned an invalid summary") {
    super("SUMMARY_GENERATION_FAILED", 502, message);
    this.name = "SummaryGenerationFailedError";
  }
}
