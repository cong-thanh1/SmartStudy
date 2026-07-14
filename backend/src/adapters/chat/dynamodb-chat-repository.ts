import { randomUUID } from "node:crypto";

import { DynamoDBClient, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

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

interface DynamoDbDocumentClientPort {
  send(command: unknown): Promise<unknown>;
}

export interface DynamoDbChatRepositoryConfig {
  readonly conversationMessagesTableName: string;
  readonly conversationsTableName: string;
}

export interface DynamoDbChatRepositoryDependencies {
  readonly client?: DynamoDbDocumentClientPort;
  readonly clientConfig?: DynamoDBClientConfig;
  readonly now?: () => Date;
  readonly newId?: () => string;
}

interface DynamoConversationItem {
  readonly conversationId: string;
  readonly createdAt: string;
  readonly documentId: string;
  readonly ownerId: string;
  readonly title: string | null;
}

interface DynamoMessageItem {
  readonly citations: readonly ChatCitation[];
  readonly content: string;
  readonly conversationId: string;
  readonly createdAt: string;
  readonly messageId: string;
  readonly messageSortKey: string;
  readonly role: ChatMessageRole;
}

export class DynamoDbChatRepository implements IChatRepository {
  private readonly client: DynamoDbDocumentClientPort;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(
    private readonly config: DynamoDbChatRepositoryConfig,
    dependencies: DynamoDbChatRepositoryDependencies = {},
  ) {
    this.client =
      dependencies.client ??
      DynamoDBDocumentClient.from(
        new DynamoDBClient(dependencies.clientConfig ?? {}),
      );
    this.now = dependencies.now ?? (() => new Date());
    this.newId = dependencies.newId ?? randomUUID;
  }

  async appendExchange(
    input: AppendConversationExchangeInput,
  ): Promise<ConversationExchange> {
    const createdAt = this.now().toISOString();
    const userMessage = this.createMessage(
      input.conversationId,
      "user",
      input.userContent,
      [],
      createdAt,
      "0",
    );
    const assistantMessage = this.createMessage(
      input.conversationId,
      "assistant",
      input.assistantContent,
      input.citations,
      createdAt,
      "1",
    );

    await this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              ConditionExpression: "attribute_exists(conversationId)",
              Key: { conversationId: input.conversationId },
              TableName: this.config.conversationsTableName,
            },
          },
          {
            Put: {
              ConditionExpression: "attribute_not_exists(conversationId)",
              Item: userMessage,
              TableName: this.config.conversationMessagesTableName,
            },
          },
          {
            Put: {
              ConditionExpression: "attribute_not_exists(conversationId)",
              Item: assistantMessage,
              TableName: this.config.conversationMessagesTableName,
            },
          },
        ],
      }),
    );

    return {
      assistantMessage: mapMessage(assistantMessage),
      userMessage: mapMessage(userMessage),
    };
  }

  async createConversation(
    input: CreateConversationInput,
  ): Promise<ConversationRecord> {
    const item: DynamoConversationItem = {
      conversationId: this.newId(),
      createdAt: this.now().toISOString(),
      documentId: input.documentId,
      ownerId: input.userId,
      title: input.title,
    };

    await this.client.send(
      new PutCommand({
        ConditionExpression: "attribute_not_exists(conversationId)",
        Item: item,
        TableName: this.config.conversationsTableName,
      }),
    );

    return mapConversation(item);
  }

  async findOwnedConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationRecord | null> {
    const response = (await this.client.send(
      new GetCommand({
        Key: { conversationId },
        TableName: this.config.conversationsTableName,
      }),
    )) as { Item?: DynamoConversationItem };
    const item = response.Item;

    if (!item || item.ownerId !== userId) {
      return null;
    }

    return mapConversation(item);
  }

  async listOwnedByDocument(
    documentId: string,
    userId: string,
  ): Promise<readonly ConversationRecord[]> {
    const response = (await this.client.send(
      new QueryCommand({
        ExpressionAttributeValues: { ":documentId": documentId, ":ownerId": userId },
        FilterExpression: "documentId = :documentId",
        IndexName: "ownerId-createdAt-index",
        KeyConditionExpression: "ownerId = :ownerId",
        ScanIndexForward: false,
        TableName: this.config.conversationsTableName,
      }),
    )) as { Items?: DynamoConversationItem[] };
    return (response.Items ?? []).map(mapConversation);
  }

  async listRecentMessages(
    conversationId: string,
    limit: number,
  ): Promise<readonly ChatMessageRecord[]> {
    const response = (await this.client.send(
      new QueryCommand({
        ExpressionAttributeValues: { ":conversationId": conversationId },
        KeyConditionExpression: "conversationId = :conversationId",
        Limit: limit,
        ScanIndexForward: false,
        TableName: this.config.conversationMessagesTableName,
      }),
    )) as { Items?: DynamoMessageItem[] };

    return (response.Items ?? [])
      .map(mapMessage)
      .sort(compareMessagesInConversation);
  }

  private createMessage(
    conversationId: string,
    role: ChatMessageRole,
    content: string,
    citations: readonly ChatCitation[],
    createdAt: string,
    exchangePosition: "0" | "1",
  ): DynamoMessageItem {
    const messageId = this.newId();

    return {
      citations,
      content,
      conversationId,
      createdAt,
      messageId,
      // The user question must always sort before its assistant answer, even
      // when both records are written in the same millisecond.
      messageSortKey: `${createdAt}#${exchangePosition}#${messageId}`,
      role,
    };
  }
}

function compareMessagesInConversation(
  left: ChatMessageRecord,
  right: ChatMessageRecord,
): number {
  const createdAtComparison = left.createdAt.getTime() - right.createdAt.getTime();
  if (createdAtComparison !== 0) return createdAtComparison;

  // Legacy records did not have the exchange-position segment in their sort
  // key. This keeps a user question above its answer when they share a time.
  if (left.role !== right.role) return left.role === "user" ? -1 : 1;
  return left.id.localeCompare(right.id);
}

function mapConversation(item: DynamoConversationItem): ConversationRecord {
  return {
    createdAt: new Date(item.createdAt),
    documentId: item.documentId,
    id: item.conversationId,
    title: item.title,
    userId: item.ownerId,
  };
}

function mapMessage(item: DynamoMessageItem): ChatMessageRecord {
  return {
    citations: item.citations,
    content: item.content,
    conversationId: item.conversationId,
    createdAt: new Date(item.createdAt),
    id: item.messageId,
    role: item.role,
  };
}
