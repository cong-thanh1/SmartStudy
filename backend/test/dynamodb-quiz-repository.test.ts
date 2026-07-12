import { describe, expect, it } from "vitest";

import { DynamoDbQuizRepository } from "../src/adapters/quiz/dynamodb-quiz-repository.js";

interface CommandWithInput {
  readonly input: Record<string, unknown>;
}

class FakeDynamoDbClient {
  readonly commands: unknown[] = [];

  constructor(private readonly responses: unknown[]) {}

  async send(command: unknown): Promise<unknown> {
    this.commands.push(command);
    return this.responses.shift() ?? {};
  }
}

function inputOf(command: unknown): Record<string, unknown> {
  return (command as CommandWithInput).input;
}

describe("DynamoDbQuizRepository", () => {
  it("saves a quiz indexed by owner, document, and creation time", async () => {
    const client = new FakeDynamoDbClient([{}]);
    const repository = createRepository(client, ["quiz-1"]);

    await expect(
      repository.save({
        difficulty: "medium",
        documentId: "document-1",
        questions: [question()],
        userId: "user-1",
      }),
    ).resolves.toMatchObject({ id: "quiz-1", userId: "user-1" });
    expect(inputOf(client.commands[0])).toMatchObject({
      Item: {
        documentCreatedAt: "document-1#2026-07-12T00:00:00.000Z",
        ownerId: "user-1",
        quizId: "quiz-1",
      },
      TableName: "quizzes",
    });
  });

  it("does not return a quiz to a different owner", async () => {
    const client = new FakeDynamoDbClient([{ Item: quizItem() }]);
    const repository = createRepository(client);

    await expect(repository.findOwnedById("quiz-1", "user-2")).resolves.toBeNull();
  });

  it("queries an owner's quizzes for a document newest first", async () => {
    const client = new FakeDynamoDbClient([{ Items: [quizItem()] }]);
    const repository = createRepository(client);

    await expect(
      repository.listOwnedByDocument("document-1", "user-1"),
    ).resolves.toMatchObject([{ id: "quiz-1" }]);
    expect(inputOf(client.commands[0])).toMatchObject({
      IndexName: "ownerId-documentCreatedAt-index",
      ScanIndexForward: false,
      TableName: "quizzes",
    });
  });
});

function createRepository(
  client: FakeDynamoDbClient,
  ids: string[] = [],
): DynamoDbQuizRepository {
  return new DynamoDbQuizRepository(
    { quizzesTableName: "quizzes" },
    {
      client,
      newId: () => ids.shift() ?? "generated-id",
      now: () => new Date("2026-07-12T00:00:00.000Z"),
    },
  );
}

function question() {
  return {
    correct_answer: "A",
    explanation: "Because A is correct",
    options: ["A", "B"],
    question_id: "q-1",
    question_text: "Which option?",
  };
}

function quizItem() {
  return {
    createdAt: "2026-07-12T00:00:00.000Z",
    difficulty: "medium",
    documentCreatedAt: "document-1#2026-07-12T00:00:00.000Z",
    documentId: "document-1",
    ownerId: "user-1",
    questions: [question()],
    quizId: "quiz-1",
  };
}
