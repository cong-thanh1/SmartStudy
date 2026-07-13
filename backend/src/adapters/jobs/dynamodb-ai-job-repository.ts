import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { AiJobRecord, IAiJobRepository } from "../../modules/jobs/job-repository.js";

type Item = { jobId: string; ownerId: string; documentId: string; kind: AiJobRecord["kind"]; input: Record<string, unknown>; status: AiJobRecord["status"]; resultId: string | null; errorMessage: string | null; createdAt: string; updatedAt: string; };

export class DynamoDbAiJobRepository implements IAiJobRepository {
  private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  constructor(private readonly tableName: string) {}
  async create(input: Omit<AiJobRecord, "createdAt" | "errorMessage" | "resultId" | "status" | "updatedAt">): Promise<AiJobRecord> {
    const now = new Date().toISOString();
    const item: Item = { ...input, jobId: input.id, createdAt: now, updatedAt: now, errorMessage: null, resultId: null, status: "queued" };
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item, ConditionExpression: "attribute_not_exists(jobId)" }));
    return map(item);
  }
  async findOwnedById(jobId: string, ownerId: string): Promise<AiJobRecord | null> {
    const output = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { jobId } }));
    const item = output.Item as Item | undefined;
    return item && (ownerId === "__worker__" || item.ownerId === ownerId) ? map(item) : null;
  }
  async markRunning(jobId: string): Promise<void> { await this.update(jobId, "#status = :status, updatedAt = :updatedAt", { "#status": "status" }, { ":status": "running", ":updatedAt": new Date().toISOString() }); }
  async markCompleted(jobId: string, resultId: string): Promise<void> { await this.update(jobId, "#status = :status, resultId = :resultId, updatedAt = :updatedAt", { "#status": "status" }, { ":status": "completed", ":resultId": resultId, ":updatedAt": new Date().toISOString() }); }
  async markFailed(jobId: string, errorMessage: string): Promise<void> { await this.update(jobId, "#status = :status, errorMessage = :errorMessage, updatedAt = :updatedAt", { "#status": "status" }, { ":status": "failed", ":errorMessage": errorMessage.slice(0, 500), ":updatedAt": new Date().toISOString() }); }
  private async update(jobId: string, expression: string, ExpressionAttributeNames: Record<string, string>, ExpressionAttributeValues: Record<string, unknown>): Promise<void> { await this.client.send(new UpdateCommand({ TableName: this.tableName, Key: { jobId }, UpdateExpression: `SET ${expression}`, ExpressionAttributeNames, ExpressionAttributeValues })); }
}
function map(item: Item): AiJobRecord { return { createdAt: new Date(item.createdAt), documentId: item.documentId, errorMessage: item.errorMessage, id: item.jobId, input: item.input, kind: item.kind, ownerId: item.ownerId, resultId: item.resultId, status: item.status, updatedAt: new Date(item.updatedAt) }; }
