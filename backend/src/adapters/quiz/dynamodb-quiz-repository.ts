import { randomUUID } from "node:crypto";

import { DynamoDBClient, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import type {
  IQuizRepository,
  QuizDifficulty,
  QuizQuestion,
  QuizRecord,
  SaveQuizInput,
} from "../../modules/quiz/quiz-repository.js";

interface DynamoDbDocumentClientPort {
  send(command: unknown): Promise<unknown>;
}

export interface DynamoDbQuizRepositoryConfig {
  readonly quizzesTableName: string;
}

export interface DynamoDbQuizRepositoryDependencies {
  readonly client?: DynamoDbDocumentClientPort;
  readonly clientConfig?: DynamoDBClientConfig;
  readonly now?: () => Date;
  readonly newId?: () => string;
}

interface DynamoQuizItem {
  readonly createdAt: string;
  readonly difficulty: QuizDifficulty | null;
  readonly documentCreatedAt: string;
  readonly documentId: string;
  readonly ownerId: string;
  readonly questions: readonly QuizQuestion[];
  readonly quizId: string;
}

export class DynamoDbQuizRepository implements IQuizRepository {
  private readonly client: DynamoDbDocumentClientPort;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(
    private readonly config: DynamoDbQuizRepositoryConfig,
    dependencies: DynamoDbQuizRepositoryDependencies = {},
  ) {
    this.client =
      dependencies.client ??
      DynamoDBDocumentClient.from(
        new DynamoDBClient(dependencies.clientConfig ?? {}),
      );
    this.now = dependencies.now ?? (() => new Date());
    this.newId = dependencies.newId ?? randomUUID;
  }

  async findOwnedById(id: string, userId: string): Promise<QuizRecord | null> {
    const response = (await this.client.send(
      new GetCommand({ Key: { quizId: id }, TableName: this.config.quizzesTableName }),
    )) as { Item?: DynamoQuizItem };
    const item = response.Item;

    return item && item.ownerId === userId ? mapQuiz(item) : null;
  }

  async listOwnedByDocument(
    documentId: string,
    userId: string,
  ): Promise<readonly QuizRecord[]> {
    const response = (await this.client.send(
      new QueryCommand({
        ExpressionAttributeValues: {
          ":documentIdPrefix": `${documentId}#`,
          ":ownerId": userId,
        },
        IndexName: "ownerId-documentCreatedAt-index",
        KeyConditionExpression:
          "ownerId = :ownerId AND begins_with(documentCreatedAt, :documentIdPrefix)",
        ScanIndexForward: false,
        TableName: this.config.quizzesTableName,
      }),
    )) as { Items?: DynamoQuizItem[] };

    return (response.Items ?? []).map(mapQuiz);
  }

  async save(input: SaveQuizInput): Promise<QuizRecord> {
    const createdAt = this.now().toISOString();
    const item: DynamoQuizItem = {
      createdAt,
      difficulty: input.difficulty ?? null,
      documentCreatedAt: `${input.documentId}#${createdAt}`,
      documentId: input.documentId,
      ownerId: input.userId,
      questions: input.questions.map(copyQuestion),
      quizId: this.newId(),
    };

    await this.client.send(
      new PutCommand({
        ConditionExpression: "attribute_not_exists(quizId)",
        Item: item,
        TableName: this.config.quizzesTableName,
      }),
    );

    return mapQuiz(item);
  }
}

function copyQuestion(question: QuizQuestion): QuizQuestion {
  return {
    correct_answer: question.correct_answer,
    explanation: question.explanation,
    options: [...question.options],
    question_id: question.question_id,
    question_text: question.question_text,
  };
}

function mapQuiz(item: DynamoQuizItem): QuizRecord {
  return {
    createdAt: new Date(item.createdAt),
    difficulty: item.difficulty,
    documentId: item.documentId,
    id: item.quizId,
    questions: item.questions.map(copyQuestion),
    userId: item.ownerId,
  };
}
