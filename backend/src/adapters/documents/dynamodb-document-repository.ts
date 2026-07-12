import { randomUUID } from "node:crypto";

import {
  DynamoDBClient,
  type DynamoDBClientConfig,
} from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import type {
  CompleteDocumentProcessingInput,
  CreateUploadingDocumentInput,
  DocumentChapter,
  DocumentChunkRecord,
  DocumentRecord,
  DocumentStatus,
  IDocumentRepository,
  ListDocumentChunksInput,
  ListOwnedDocumentsInput,
  ListOwnedDocumentsResult,
} from "../../modules/documents/document-repository.js";

interface DynamoDbDocumentClientPort {
  send(command: unknown): Promise<unknown>;
}

export interface DynamoDbDocumentRepositoryConfig {
  readonly chunksTableName: string;
  readonly documentsTableName: string;
}

export interface DynamoDbDocumentRepositoryDependencies {
  readonly client?: DynamoDbDocumentClientPort;
  readonly clientConfig?: DynamoDBClientConfig;
  readonly now?: () => Date;
  readonly newId?: () => string;
}

interface DynamoDocumentItem {
  readonly chapters?: unknown;
  readonly createdAt: string;
  readonly deleted: boolean;
  readonly documentId: string;
  readonly fileKey: string;
  readonly ownerId: string;
  readonly pageCount?: number;
  readonly sizeBytes?: number;
  readonly status: string;
  readonly title: string;
}

interface DynamoChunkItem {
  readonly chapterTitle: string | null;
  readonly chunkId: string;
  readonly chunkText: string;
  readonly pageEnd: number;
  readonly pageStart: number;
}

export class DynamoDbDocumentRepository implements IDocumentRepository {
  private readonly client: DynamoDbDocumentClientPort;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(
    private readonly config: DynamoDbDocumentRepositoryConfig,
    dependencies: DynamoDbDocumentRepositoryDependencies = {},
  ) {
    this.client =
      dependencies.client ??
      DynamoDBDocumentClient.from(
        new DynamoDBClient(dependencies.clientConfig ?? {}),
      );
    this.now = dependencies.now ?? (() => new Date());
    this.newId = dependencies.newId ?? randomUUID;
  }

  async createUploading(
    input: CreateUploadingDocumentInput,
  ): Promise<DocumentRecord> {
    const createdAt = this.now().toISOString();
    const item: DynamoDocumentItem = {
      chapters: [],
      createdAt,
      deleted: false,
      documentId: input.id,
      fileKey: input.fileKey,
      ownerId: input.userId,
      sizeBytes: input.sizeBytes,
      status: "uploading",
      title: input.title,
    };

    await this.client.send(
      new PutCommand({
        ConditionExpression: "attribute_not_exists(documentId)",
        Item: item,
        TableName: this.config.documentsTableName,
      }),
    );

    return mapDocument(item);
  }

  async findOwnedById(
    documentId: string,
    userId: string,
  ): Promise<DocumentRecord | null> {
    const response = (await this.client.send(
      new GetCommand({
        Key: { documentId },
        TableName: this.config.documentsTableName,
      }),
    )) as { Item?: DynamoDocumentItem };
    const item = response.Item;

    if (!item || item.deleted || item.ownerId !== userId) {
      return null;
    }

    return mapDocument(item);
  }

  async listChunks(
    input: ListDocumentChunksInput,
  ): Promise<readonly DocumentChunkRecord[]> {
    if (!(await this.findOwnedById(input.documentId, input.userId))) {
      return [];
    }

    const chunks: DynamoChunkItem[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const response = (await this.client.send(
        new QueryCommand({
          ExclusiveStartKey: exclusiveStartKey,
          KeyConditionExpression: "documentId = :documentId",
          ExpressionAttributeValues: { ":documentId": input.documentId },
          TableName: this.config.chunksTableName,
        }),
      )) as {
        Items?: DynamoChunkItem[];
        LastEvaluatedKey?: Record<string, unknown>;
      };
      chunks.push(...(response.Items ?? []));
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return chunks
      .filter(
        (chunk) =>
          input.chapterTitle === undefined ||
          chunk.chapterTitle === input.chapterTitle,
      )
      .sort(compareChunks)
      .map((chunk) => ({
        chapterTitle: chunk.chapterTitle,
        chunkText: chunk.chunkText,
        id: chunk.chunkId,
        pageEnd: chunk.pageEnd,
        pageStart: chunk.pageStart,
      }));
  }

  async listOwned(
    input: ListOwnedDocumentsInput,
  ): Promise<ListOwnedDocumentsResult> {
    const items: DynamoDocumentItem[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const response = (await this.client.send(
        new QueryCommand({
          ExclusiveStartKey: exclusiveStartKey,
          ExpressionAttributeValues: { ":ownerId": input.userId },
          IndexName: "ownerId-createdAt-index",
          KeyConditionExpression: "ownerId = :ownerId",
          ScanIndexForward: false,
          TableName: this.config.documentsTableName,
        }),
      )) as {
        Items?: DynamoDocumentItem[];
        LastEvaluatedKey?: Record<string, unknown>;
      };
      items.push(...(response.Items ?? []));
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);

    const search = input.search?.trim().toLocaleLowerCase();
    const owned = items
      .filter((item) => !item.deleted)
      .filter((item) => input.status === undefined || item.status === input.status)
      .filter(
        (item) =>
          !search || item.title.toLocaleLowerCase().includes(search),
      )
      .sort(compareDocuments);
    const offset = (input.page - 1) * input.limit;

    return {
      documents: owned.slice(offset, offset + input.limit).map(mapDocument),
      total: owned.length,
    };
  }

  async markFailed(documentId: string, userId: string): Promise<boolean> {
    return this.transitionStatus(documentId, userId, "processing", "failed");
  }

  async markProcessing(
    documentId: string,
    userId: string,
  ): Promise<boolean> {
    return this.transitionStatus(documentId, userId, "uploading", "processing");
  }

  async replaceChunksAndMarkReady(
    input: CompleteDocumentProcessingInput,
  ): Promise<boolean> {
    const chunks = input.chunks.map((chunk) => toChunkItem(chunk, this.newId));

    for (const batch of splitIntoBatches(chunks, 25)) {
      await this.client.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.config.chunksTableName]: batch.map((chunk) => ({
              PutRequest: { Item: { ...chunk, documentId: input.documentId } },
            })),
          },
        }),
      );
    }

    try {
      await this.client.send(
        new UpdateCommand({
          ConditionExpression:
            "ownerId = :ownerId AND #status = :processing AND deleted = :notDeleted",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":chapters": input.chapters.map(toStoredChapter),
            ":notDeleted": false,
            ":ownerId": input.userId,
            ":pageCount": input.pageCount,
            ":processing": "processing",
            ":ready": "ready",
          },
          Key: { documentId: input.documentId },
          TableName: this.config.documentsTableName,
          UpdateExpression:
            "SET chapters = :chapters, pageCount = :pageCount, #status = :ready",
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        return false;
      }
      throw error;
    }
  }

  async softDeleteOwned(documentId: string, userId: string): Promise<boolean> {
    try {
      await this.client.send(
        new UpdateCommand({
          ConditionExpression: "ownerId = :ownerId AND deleted = :notDeleted",
          ExpressionAttributeValues: {
            ":deleted": true,
            ":notDeleted": false,
            ":ownerId": userId,
          },
          Key: { documentId },
          TableName: this.config.documentsTableName,
          UpdateExpression: "SET deleted = :deleted",
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        return false;
      }
      throw error;
    }
  }

  private async transitionStatus(
    documentId: string,
    userId: string,
    current: DocumentStatus,
    next: DocumentStatus,
  ): Promise<boolean> {
    try {
      await this.client.send(
        new UpdateCommand({
          ConditionExpression:
            "ownerId = :ownerId AND #status = :current AND deleted = :notDeleted",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":current": current,
            ":next": next,
            ":notDeleted": false,
            ":ownerId": userId,
          },
          Key: { documentId },
          TableName: this.config.documentsTableName,
          UpdateExpression: "SET #status = :next",
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        return false;
      }
      throw error;
    }
  }
}

function compareChunks(left: DynamoChunkItem, right: DynamoChunkItem): number {
  return (
    left.pageStart - right.pageStart ||
    left.pageEnd - right.pageEnd ||
    left.chunkId.localeCompare(right.chunkId)
  );
}

function compareDocuments(
  left: DynamoDocumentItem,
  right: DynamoDocumentItem,
): number {
  return (
    right.createdAt.localeCompare(left.createdAt) ||
    right.documentId.localeCompare(left.documentId)
  );
}

function isConditionalCheckFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ConditionalCheckFailedException"
  );
}

function mapDocument(item: DynamoDocumentItem): DocumentRecord {
  return {
    chapters: parseChapters(item.chapters),
    createdAt: new Date(item.createdAt),
    fileKey: item.fileKey,
    id: item.documentId,
    pageCount: item.pageCount ?? null,
    sizeBytes: item.sizeBytes ?? null,
    status: parseDocumentStatus(item.status),
    title: item.title,
    userId: item.ownerId,
  };
}

function parseChapters(value: unknown): readonly DocumentChapter[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Document chapters stored in DynamoDB must be an array");
  }
  return value.map((chapter) => {
    if (!chapter || typeof chapter !== "object") {
      throw new Error("Document chapter stored in DynamoDB is invalid");
    }
    const record = chapter as Record<string, unknown>;
    if (
      typeof record.chapterTitle !== "string" ||
      typeof record.startPage !== "number" ||
      typeof record.endPage !== "number"
    ) {
      throw new Error("Document chapter stored in DynamoDB is invalid");
    }
    return {
      chapterTitle: record.chapterTitle,
      endPage: record.endPage,
      startPage: record.startPage,
    };
  });
}

function parseDocumentStatus(status: string): DocumentStatus {
  if (
    status === "failed" ||
    status === "processing" ||
    status === "ready" ||
    status === "uploading"
  ) {
    return status;
  }
  throw new Error(`Unsupported document status stored in DynamoDB: ${status}`);
}

function splitIntoBatches<T>(items: readonly T[], size: number): readonly T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function toChunkItem(
  chunk: CompleteDocumentProcessingInput["chunks"][number],
  newId: () => string,
): DynamoChunkItem {
  return {
    chapterTitle: chunk.chapterTitle,
    chunkId: newId(),
    chunkText: chunk.chunkText,
    pageEnd: chunk.pageEnd,
    pageStart: chunk.pageStart,
  };
}

function toStoredChapter(chapter: DocumentChapter): Record<string, unknown> {
  return {
    chapterTitle: chapter.chapterTitle,
    endPage: chapter.endPage,
    startPage: chapter.startPage,
  };
}
