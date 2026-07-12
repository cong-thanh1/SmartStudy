import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { loadSqsQueueConfig } from "../src/adapters/queue/sqs-queue-config.js";

describe("SQS queue config", () => {
  it("loads production defaults", () => {
    expect(
      loadSqsQueueConfig({
        SQS_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/123/queue",
      }),
    ).toEqual({
      pollErrorDelayMilliseconds: 1_000,
      queueName: "document-processing",
      queueUrl: "https://sqs.us-east-1.amazonaws.com/123/queue",
      visibilityTimeoutSeconds: 120,
      waitTimeSeconds: 20,
      workerConcurrency: 1,
    });
  });

  it.each([
    {},
    { SQS_QUEUE_URL: "not-a-url" },
    { SQS_QUEUE_URL: "https://example.test/queue", SQS_WAIT_TIME_SECONDS: "21" },
    { SQS_QUEUE_URL: "https://example.test/queue", SQS_VISIBILITY_TIMEOUT_SECONDS: "43201" },
  ])("rejects invalid config %#", (environment) => {
    expect(() => loadSqsQueueConfig(environment)).toThrow(ZodError);
  });
});
