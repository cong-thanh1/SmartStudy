import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  AppendConversationExchangeInput,
  ChatCitation,
  ChatMessageRecord,
  ChatMessageRole,
  ConversationExchange,
  ConversationRecord,
  CreateConversationInput,
  IChatRepository,
} from "../../modules/chat/chat-repository.js";

const conversationSelection = {
  createdAt: true,
  documentId: true,
  id: true,
  title: true,
  userId: true,
} as const;

const messageSelection = {
  citations: true,
  content: true,
  conversationId: true,
  createdAt: true,
  id: true,
  role: true,
} as const;

export class PrismaChatRepository implements IChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async appendExchange(
    input: AppendConversationExchangeInput,
  ): Promise<ConversationExchange> {
    return this.prisma.$transaction(async (transaction) => {
      const userMessage = await transaction.message.create({
        data: {
          citations: [],
          content: input.userContent,
          conversationId: input.conversationId,
          role: "user",
        },
        select: messageSelection,
      });
      const assistantMessage = await transaction.message.create({
        data: {
          citations: toCitationJson(input.citations),
          content: input.assistantContent,
          conversationId: input.conversationId,
          role: "assistant",
        },
        select: messageSelection,
      });

      return {
        assistantMessage: mapMessage(assistantMessage),
        userMessage: mapMessage(userMessage),
      };
    });
  }

  async createConversation(
    input: CreateConversationInput,
  ): Promise<ConversationRecord> {
    const conversation = await this.prisma.conversation.create({
      data: {
        documentId: input.documentId,
        title: input.title,
        userId: input.userId,
      },
      select: conversationSelection,
    });

    return mapConversation(conversation);
  }

  async findOwnedConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationRecord | null> {
    const conversation = await this.prisma.conversation.findFirst({
      select: conversationSelection,
      where: {
        documentId: {
          not: null,
        },
        id: conversationId,
        userId,
      },
    });

    return conversation ? mapConversation(conversation) : null;
  }

  async listRecentMessages(
    conversationId: string,
    limit: number,
  ): Promise<readonly ChatMessageRecord[]> {
    const messages = await this.prisma.message.findMany({
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: messageSelection,
      take: limit,
      where: {
        conversationId,
      },
    });

    return messages.reverse().map(mapMessage);
  }
}

interface DatabaseConversation {
  readonly createdAt: Date;
  readonly documentId: string | null;
  readonly id: string;
  readonly title: string | null;
  readonly userId: string;
}

interface DatabaseMessage {
  readonly citations: unknown;
  readonly content: string;
  readonly conversationId: string;
  readonly createdAt: Date;
  readonly id: string;
  readonly role: string;
}

function mapConversation(
  conversation: DatabaseConversation,
): ConversationRecord {
  if (conversation.documentId === null) {
    throw new Error("Chat conversation must reference a document");
  }

  return {
    createdAt: conversation.createdAt,
    documentId: conversation.documentId,
    id: conversation.id,
    title: conversation.title,
    userId: conversation.userId,
  };
}

function mapMessage(message: DatabaseMessage): ChatMessageRecord {
  return {
    citations: parseCitations(message.citations),
    content: message.content,
    conversationId: message.conversationId,
    createdAt: message.createdAt,
    id: message.id,
    role: parseMessageRole(message.role),
  };
}

function parseMessageRole(role: string): ChatMessageRole {
  if (role === "assistant" || role === "user") {
    return role;
  }

  throw new Error(`Unsupported chat message role stored in database: ${role}`);
}

function parseCitations(value: unknown): readonly ChatCitation[] {
  if (!Array.isArray(value)) {
    throw new Error("Chat message citations stored in database must be an array");
  }

  return value.map((citation, index) => {
    if (!citation || typeof citation !== "object") {
      throw new Error(`Chat citation ${index} stored in database is invalid`);
    }

    const record = citation as Record<string, unknown>;
    const documentId = record.document_id;
    const page = record.page;
    const snippet = record.snippet;

    if (
      typeof documentId !== "string" ||
      typeof snippet !== "string" ||
      snippet.trim().length === 0 ||
      (page !== null &&
        (typeof page !== "number" ||
          !Number.isSafeInteger(page) ||
          page < 1))
    ) {
      throw new Error(`Chat citation ${index} stored in database is invalid`);
    }

    return {
      documentId,
      page,
      snippet,
    };
  });
}

function toCitationJson(
  citations: readonly ChatCitation[],
): Prisma.InputJsonValue {
  return citations.map((citation) => ({
    document_id: citation.documentId,
    page: citation.page,
    snippet: citation.snippet,
  }));
}
