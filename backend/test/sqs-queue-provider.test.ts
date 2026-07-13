import { describe, expect, it, vi } from "vitest";

import { QueueProviderClosedError } from "../src/adapters/queue/redis-queue-provider.js";
import { SqsQueueProvider } from "../src/adapters/queue/sqs-queue-provider.js";
import type { SqsQueueConfig } from "../src/adapters/queue/sqs-queue-config.js";

const config: SqsQueueConfig = {
  pollErrorDelayMilliseconds: 100,
  queueName: "document-processing",
  queueUrl: "https://sqs.us-east-1.amazonaws.com/123/queue",
  visibilityTimeoutSeconds: 120,
  waitTimeSeconds: 1,
  workerConcurrency: 1,
};

describe("SqsQueueProvider", () => {
  it("enqueues a JSON envelope and returns an SQS message id", async () => {
    const sendMessage = vi.fn(async () => ({ $metadata: {}, MessageId: "message-1" }));
    const provider = new SqsQueueProvider(config, { sendMessage });

    await expect(
      provider.enqueue("document-processing", { documentId: "document-1" }),
    ).resolves.toEqual({ jobId: "message-1" });
    expect(sendMessage).toHaveBeenCalledWith({
      MessageBody: JSON.stringify({
        data: { documentId: "document-1" },
        name: "document-processing",
      }),
      QueueUrl: config.queueUrl,
    });
  });

  it("rejects invalid queue usage and work after shutdown", async () => {
    const provider = new SqsQueueProvider(config, {
      sendMessage: async () => ({ $metadata: {}, MessageId: "message-1" }),
    });

    await expect(provider.enqueue("other", {})).rejects.toThrow(RangeError);
    await expect(
      provider.enqueue("document-processing", {}, { delayMilliseconds: 900_001 }),
    ).rejects.toThrow(RangeError);
    await provider.close();
    await expect(provider.enqueue("document-processing", {})).rejects.toThrow(
      QueueProviderClosedError,
    );
  });

  it("processes a received message, maps retry attempts, and deletes only after success", async () => {
    let releasePolling: ((value: { Messages: [] }) => void) | undefined;
    const receiveMessage = vi
      .fn()
      .mockResolvedValueOnce({
        $metadata: {},
        Messages: [
          {
            Attributes: { ApproximateReceiveCount: "3" },
            Body: JSON.stringify({
              data: { documentId: "document-1" },
              jobId: "job-1",
              name: "document-processing",
            }),
            MessageId: "message-1",
            ReceiptHandle: "receipt-1",
          },
        ],
      })
      .mockImplementationOnce(
        () => new Promise((resolve) => { releasePolling = resolve; }),
      );
    const deleteMessage = vi.fn(async () => undefined);
    const handler = vi.fn(async () => undefined);
    const provider = new SqsQueueProvider(config, {
      deleteMessage,
      receiveMessage,
    });

    const consumer = await provider.consume("document-processing", handler);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    expect(handler).toHaveBeenCalledWith({
      attemptsMade: 2,
      data: { documentId: "document-1" },
      id: "job-1",
      name: "document-processing",
    });
    expect(deleteMessage).toHaveBeenCalledWith({
      QueueUrl: config.queueUrl,
      ReceiptHandle: "receipt-1",
    });

    await vi.waitFor(() => expect(receiveMessage).toHaveBeenCalledTimes(2));
    const closing = consumer.close();
    releasePolling?.({ Messages: [] });
    await closing;
  });

  it("keeps failed messages for retry and reports polling errors without payload data", async () => {
    let releasePolling: ((value: { Messages: [] }) => void) | undefined;
    const receiveMessage = vi
      .fn()
      .mockResolvedValueOnce({
        $metadata: {},
        Messages: [
          {
            Body: JSON.stringify({ data: { secret: "not logged" }, name: "document-processing" }),
            MessageId: "message-1",
            ReceiptHandle: "receipt-1",
          },
        ],
      })
      .mockImplementationOnce(
        () => new Promise((resolve) => { releasePolling = resolve; }),
      );
    const deleteMessage = vi.fn(async () => undefined);
    const onWorkerError = vi.fn();
    const provider = new SqsQueueProvider(config, {
      deleteMessage,
      onWorkerError,
      receiveMessage,
    });

    const consumer = await provider.consume("document-processing", async () => {
      throw new Error("processing failed");
    });
    await vi.waitFor(() => expect(onWorkerError).toHaveBeenCalledOnce());
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(onWorkerError).toHaveBeenCalledWith(
      "document-processing",
      expect.objectContaining({ name: "Error" }),
    );

    await vi.waitFor(() => expect(receiveMessage).toHaveBeenCalledTimes(2));
    const closing = consumer.close();
    releasePolling?.({ Messages: [] });
    await closing;
  });
});
