import { describe, expect, it } from "vitest";

import { DynamoDbExamRepository } from "../src/adapters/exam/dynamodb-exam-repository.js";

class FakeClient {
  readonly commands: unknown[] = [];
  constructor(private readonly responses: unknown[]) {}
  async send(command: unknown): Promise<unknown> { this.commands.push(command); return this.responses.shift() ?? {}; }
}

describe("DynamoDbExamRepository", () => {
  it("saves an exam and attempt with owner-specific indexes", async () => {
    const client = new FakeClient([{}, {}]);
    const ids = ["exam-1", "attempt-1"];
    const repository = new DynamoDbExamRepository(
      { attemptsTableName: "attempts", examsTableName: "exams" },
      { client, newId: () => ids.shift() ?? "id", now: () => new Date("2026-07-12T00:00:00.000Z") },
    );
    await expect(repository.save({ answerKey: [], documentId: "document-1", numQuestions: 1, questions: [], userId: "user-1" })).resolves.toMatchObject({ id: "exam-1" });
    await expect(repository.saveAttempt({ answers: [], detailedResult: [], examId: "exam-1", maxScore: 1, score: 1, userId: "user-1" })).resolves.toMatchObject({ id: "attempt-1" });
  });

  it("does not return records owned by another user", async () => {
    const client = new FakeClient([{ Item: { attemptId: "attempt-1", ownerId: "user-1" } }, { Item: { examId: "exam-1", ownerId: "user-1" } }]);
    const repository = new DynamoDbExamRepository({ attemptsTableName: "attempts", examsTableName: "exams" }, { client });
    await expect(repository.findAttemptById("attempt-1", "user-2")).resolves.toBeNull();
    await expect(repository.findOwnedById("exam-1", "user-2")).resolves.toBeNull();
  });
});
