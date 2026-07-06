export type ChatMessageRole = "assistant" | "user";

export interface ChatCitation {
  readonly documentId: string;
  readonly page: number | null;
  readonly snippet: string;
}

export interface ConversationRecord {
  readonly createdAt: Date;
  readonly documentId: string;
  readonly id: string;
  readonly title: string | null;
  readonly userId: string;
}

export interface ChatMessageRecord {
  readonly citations: readonly ChatCitation[];
  readonly content: string;
  readonly conversationId: string;
  readonly createdAt: Date;
  readonly id: string;
  readonly role: ChatMessageRole;
}

export interface CreateConversationInput {
  readonly documentId: string;
  readonly title: string;
  readonly userId: string;
}

export interface AppendConversationExchangeInput {
  readonly assistantContent: string;
  readonly citations: readonly ChatCitation[];
  readonly conversationId: string;
  readonly userContent: string;
}

export interface ConversationExchange {
  readonly assistantMessage: ChatMessageRecord;
  readonly userMessage: ChatMessageRecord;
}

export interface IChatRepository {
  appendExchange(
    input: AppendConversationExchangeInput,
  ): Promise<ConversationExchange>;
  createConversation(
    input: CreateConversationInput,
  ): Promise<ConversationRecord>;
  findOwnedConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationRecord | null>;
  listRecentMessages(
    conversationId: string,
    limit: number,
  ): Promise<readonly ChatMessageRecord[]>;
}
