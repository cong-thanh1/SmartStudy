export type ChatErrorCode =
  | "CHAT_CONTEXT_NOT_FOUND"
  | "CHAT_DOCUMENT_NOT_FOUND"
  | "CHAT_DOCUMENT_NOT_READY"
  | "CONVERSATION_NOT_FOUND";

export class ChatError extends Error {
  constructor(
    readonly code: ChatErrorCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ChatError";
  }
}

export class ChatDocumentNotFoundError extends ChatError {
  constructor() {
    super(
      "CHAT_DOCUMENT_NOT_FOUND",
      404,
      "Document was not found",
    );
    this.name = "ChatDocumentNotFoundError";
  }
}

export class ChatDocumentNotReadyError extends ChatError {
  constructor() {
    super(
      "CHAT_DOCUMENT_NOT_READY",
      409,
      "Document must be ready before starting a chat",
    );
    this.name = "ChatDocumentNotReadyError";
  }
}

export class ConversationNotFoundError extends ChatError {
  constructor() {
    super(
      "CONVERSATION_NOT_FOUND",
      404,
      "Conversation was not found",
    );
    this.name = "ConversationNotFoundError";
  }
}

export class ChatContextNotFoundError extends ChatError {
  constructor() {
    super(
      "CHAT_CONTEXT_NOT_FOUND",
      409,
      "No searchable document context was found",
    );
    this.name = "ChatContextNotFoundError";
  }
}
