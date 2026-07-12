import { randomUUID } from "node:crypto";

import { DynamoDBClient, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import type {
  ExamAttemptRecord,
  ExamRecord,
  IExamRepository,
  SaveExamAttemptInput,
  SaveExamInput,
} from "../../modules/exam/exam-repository.js";

interface Client { send(command: unknown): Promise<unknown>; }

export interface DynamoDbExamRepositoryConfig {
  readonly attemptsTableName: string;
  readonly examsTableName: string;
}

export interface DynamoDbExamRepositoryDependencies {
  readonly client?: Client;
  readonly clientConfig?: DynamoDBClientConfig;
  readonly now?: () => Date;
  readonly newId?: () => string;
}

interface ExamItem {
  readonly answerKey: SaveExamInput["answerKey"];
  readonly createdAt: string;
  readonly difficultyDistribution: SaveExamInput["difficultyDistribution"];
  readonly documentCreatedAt: string;
  readonly documentId: string;
  readonly examId: string;
  readonly numQuestions: number;
  readonly ownerId: string;
  readonly questions: SaveExamInput["questions"];
  readonly timeLimitMinutes: number | null;
}

interface AttemptItem {
  readonly aiFeedback: string | null;
  readonly answers: SaveExamAttemptInput["answers"];
  readonly detailedResult: SaveExamAttemptInput["detailedResult"];
  readonly examId: string | null;
  readonly examSubmittedAt: string;
  readonly maxScore: number;
  readonly ownerId: string;
  readonly quizId: string | null;
  readonly score: number;
  readonly submittedAt: string;
  readonly attemptId: string;
}

export class DynamoDbExamRepository implements IExamRepository {
  private readonly client: Client;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly config: DynamoDbExamRepositoryConfig, dependencies: DynamoDbExamRepositoryDependencies = {}) {
    this.client = dependencies.client ?? DynamoDBDocumentClient.from(new DynamoDBClient(dependencies.clientConfig ?? {}));
    this.now = dependencies.now ?? (() => new Date());
    this.newId = dependencies.newId ?? randomUUID;
  }

  async findAttemptById(id: string, userId: string): Promise<ExamAttemptRecord | null> {
    const response = (await this.client.send(new GetCommand({ Key: { attemptId: id }, TableName: this.config.attemptsTableName }))) as { Item?: AttemptItem };
    return response.Item && response.Item.ownerId === userId ? mapAttempt(response.Item) : null;
  }

  async findOwnedById(id: string, userId: string): Promise<ExamRecord | null> {
    const response = (await this.client.send(new GetCommand({ Key: { examId: id }, TableName: this.config.examsTableName }))) as { Item?: ExamItem };
    return response.Item && response.Item.ownerId === userId ? mapExam(response.Item) : null;
  }

  async listAttemptsByExam(examId: string, userId: string): Promise<readonly ExamAttemptRecord[]> {
    const response = (await this.client.send(new QueryCommand({
      ExpressionAttributeValues: { ":examPrefix": `${examId}#`, ":ownerId": userId },
      IndexName: "ownerId-examSubmittedAt-index",
      KeyConditionExpression: "ownerId = :ownerId AND begins_with(examSubmittedAt, :examPrefix)",
      ScanIndexForward: false,
      TableName: this.config.attemptsTableName,
    }))) as { Items?: AttemptItem[] };
    return (response.Items ?? []).map(mapAttempt);
  }

  async listOwnedByDocument(documentId: string, userId: string): Promise<readonly ExamRecord[]> {
    const response = (await this.client.send(new QueryCommand({
      ExpressionAttributeValues: { ":documentPrefix": `${documentId}#`, ":ownerId": userId },
      IndexName: "ownerId-documentCreatedAt-index",
      KeyConditionExpression: "ownerId = :ownerId AND begins_with(documentCreatedAt, :documentPrefix)",
      ScanIndexForward: false,
      TableName: this.config.examsTableName,
    }))) as { Items?: ExamItem[] };
    return (response.Items ?? []).map(mapExam);
  }

  async save(input: SaveExamInput): Promise<ExamRecord> {
    const createdAt = this.now().toISOString();
    const item: ExamItem = {
      answerKey: input.answerKey.map(copy),
      createdAt,
      difficultyDistribution: input.difficultyDistribution ?? null,
      documentCreatedAt: `${input.documentId}#${createdAt}`,
      documentId: input.documentId,
      examId: this.newId(),
      numQuestions: input.numQuestions,
      ownerId: input.userId,
      questions: input.questions.map(copy),
      timeLimitMinutes: input.timeLimitMinutes ?? null,
    };
    await this.client.send(new PutCommand({ ConditionExpression: "attribute_not_exists(examId)", Item: item, TableName: this.config.examsTableName }));
    return mapExam(item);
  }

  async saveAttempt(input: SaveExamAttemptInput): Promise<ExamAttemptRecord> {
    const submittedAt = this.now().toISOString();
    const item: AttemptItem = {
      aiFeedback: input.aiFeedback ?? null,
      answers: input.answers.map(copy),
      attemptId: this.newId(),
      detailedResult: input.detailedResult.map(copy),
      examId: input.examId ?? null,
      examSubmittedAt: `${input.examId ?? "quiz"}#${submittedAt}`,
      maxScore: input.maxScore,
      ownerId: input.userId,
      quizId: input.quizId ?? null,
      score: input.score,
      submittedAt,
    };
    await this.client.send(new PutCommand({ ConditionExpression: "attribute_not_exists(attemptId)", Item: item, TableName: this.config.attemptsTableName }));
    return mapAttempt(item);
  }
}

function copy<T>(value: T): T { return structuredClone(value); }

function mapExam(item: ExamItem): ExamRecord {
  return { answerKey: item.answerKey.map(copy), createdAt: new Date(item.createdAt), difficultyDistribution: item.difficultyDistribution ?? null, documentId: item.documentId, id: item.examId, numQuestions: item.numQuestions, questions: item.questions.map(copy), timeLimitMinutes: item.timeLimitMinutes, userId: item.ownerId };
}

function mapAttempt(item: AttemptItem): ExamAttemptRecord {
  return { aiFeedback: item.aiFeedback, answers: item.answers.map(copy), detailedResult: item.detailedResult.map(copy), examId: item.examId, id: item.attemptId, maxScore: item.maxScore, quizId: item.quizId, score: item.score, submittedAt: new Date(item.submittedAt), userId: item.ownerId };
}
