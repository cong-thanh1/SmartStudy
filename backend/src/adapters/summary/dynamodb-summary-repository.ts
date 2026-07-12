import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import type { ISummaryRepository, SummaryRecord } from "../../modules/summary/summary-repository.js";

interface Client { send(command: unknown): Promise<unknown>; }
interface Item { summaryKey: string; id: string; documentId: string; scope: "chapter" | "full"; chapterRef: string | null; keyPoints: string[]; summaryText: string; createdAt: string; }

export class DynamoDbSummaryRepository implements ISummaryRepository {
  private readonly client: Client;
  constructor(private readonly tableName: string, private readonly now = () => new Date(), private readonly newId = randomUUID, client?: Client) { this.client = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({})); }
  async findChapterSummary(input: { chapterRef: string; documentId: string }): Promise<SummaryRecord | null> { return this.find(input.documentId, "chapter", input.chapterRef); }
  async findFullDocumentSummary(documentId: string): Promise<SummaryRecord | null> { return this.find(documentId, "full", null); }
  async saveChapterSummary(input: { chapterRef: string; documentId: string; keyPoints: readonly string[]; summaryText: string }): Promise<SummaryRecord> { return this.save(input.documentId, "chapter", input.chapterRef, input.keyPoints, input.summaryText); }
  async saveFullDocumentSummary(input: { documentId: string; keyPoints: readonly string[]; summaryText: string }): Promise<SummaryRecord> { return this.save(input.documentId, "full", null, input.keyPoints, input.summaryText); }
  private key(documentId: string, scope: "chapter" | "full", chapterRef: string | null): string { return `${documentId}#${scope}#${chapterRef ?? "-"}`; }
  private async find(documentId: string, scope: "chapter" | "full", chapterRef: string | null): Promise<SummaryRecord | null> { const r = await this.client.send(new GetCommand({ Key: { summaryKey: this.key(documentId, scope, chapterRef) }, TableName: this.tableName })) as { Item?: Item }; return r.Item ? map(r.Item) : null; }
  private async save(documentId: string, scope: "chapter" | "full", chapterRef: string | null, keyPoints: readonly string[], summaryText: string): Promise<SummaryRecord> { const item: Item = { summaryKey: this.key(documentId, scope, chapterRef), id: this.newId(), documentId, scope, chapterRef, keyPoints: [...keyPoints], summaryText, createdAt: this.now().toISOString() }; await this.client.send(new PutCommand({ Item: item, TableName: this.tableName })); return map(item); }
}
function map(item: Item): SummaryRecord { return { id: item.id, documentId: item.documentId, scope: item.scope, chapterRef: item.chapterRef, keyPoints: item.keyPoints, summaryText: item.summaryText, createdAt: new Date(item.createdAt) }; }
