import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
  type DeleteMessageCommandInput,
  type ReceiveMessageCommandInput,
  type ReceiveMessageCommandOutput,
  type SendMessageCommandInput,
  type SendMessageCommandOutput,
} from "@aws-sdk/client-sqs";

import type {
  EnqueueOptions,
  IQueueProvider,
  QueueConsumer,
  QueueHandler,
  QueueJob,
} from "../../ports/index.js";
import { QueueProviderClosedError } from "./redis-queue-provider.js";
import type { SqsQueueConfig } from "./sqs-queue-config.js";

interface SqsJobEnvelope {
  readonly data: unknown;
  readonly jobId?: string;
  readonly name: string;
}

export type SqsSendMessage = (
  input: SendMessageCommandInput,
) => Promise<SendMessageCommandOutput>;
export type SqsReceiveMessage = (
  input: ReceiveMessageCommandInput,
) => Promise<ReceiveMessageCommandOutput>;
export type SqsDeleteMessage = (input: DeleteMessageCommandInput) => Promise<void>;

export interface SqsQueueProviderDependencies {
  readonly deleteMessage?: SqsDeleteMessage;
  readonly onWorkerError?: (queueName: string, error: Error) => void;
  readonly receiveMessage?: SqsReceiveMessage;
  readonly sendMessage?: SqsSendMessage;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

export class SqsQueueProvider implements IQueueProvider {
  private readonly consumers = new Set<SqsPollingConsumer<unknown>>();
  private readonly deleteMessage: SqsDeleteMessage;
  private readonly onWorkerError: (queueName: string, error: Error) => void;
  private readonly receiveMessage: SqsReceiveMessage;
  private readonly sendMessage: SqsSendMessage;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private closed = false;

  constructor(
    private readonly config: SqsQueueConfig,
    dependencies: SqsQueueProviderDependencies = {},
  ) {
    const client = new SQSClient({});
    this.deleteMessage =
      dependencies.deleteMessage ??
      (async (input) => {
        await client.send(new DeleteMessageCommand(input));
      });
    this.onWorkerError = dependencies.onWorkerError ?? logWorkerError;
    this.receiveMessage =
      dependencies.receiveMessage ??
      ((input) => client.send(new ReceiveMessageCommand(input)));
    this.sendMessage =
      dependencies.sendMessage ??
      ((input) => client.send(new SendMessageCommand(input)));
    this.sleep = dependencies.sleep ?? delay;
  }

  async consume<TData>(
    queueName: string,
    handler: QueueHandler<TData>,
  ): Promise<QueueConsumer> {
    this.assertOpen();
    this.assertQueueName(queueName);

    const consumer = new SqsPollingConsumer<TData>(
      this.config,
      handler,
      this.receiveMessage,
      this.deleteMessage,
      this.sleep,
      this.onWorkerError,
    );
    this.consumers.add(consumer as SqsPollingConsumer<unknown>);
    consumer.start();

    return {
      close: async () => {
        this.consumers.delete(consumer as SqsPollingConsumer<unknown>);
        await consumer.close();
      },
    };
  }

  async enqueue<TData>(
    queueName: string,
    data: TData,
    options: EnqueueOptions = {},
  ): Promise<{ readonly jobId: string }> {
    this.assertOpen();
    this.assertQueueName(queueName);
    validateEnqueueOptions(options);

    const response = await this.sendMessage({
      ...(options.delayMilliseconds === undefined
        ? {}
        : { DelaySeconds: Math.ceil(options.delayMilliseconds / 1_000) }),
      MessageBody: JSON.stringify({
        data,
        ...(options.jobId === undefined ? {} : { jobId: options.jobId }),
        name: queueName,
      } satisfies SqsJobEnvelope),
      QueueUrl: this.config.queueUrl,
    });
    const jobId = options.jobId ?? response.MessageId;

    if (!jobId) {
      throw new Error("SQS did not return a message id");
    }

    return { jobId };
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await Promise.all([...this.consumers].map((consumer) => consumer.close()));
    this.consumers.clear();
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new QueueProviderClosedError();
    }
  }

  private assertQueueName(queueName: string): void {
    if (queueName !== this.config.queueName) {
      throw new RangeError(`SQS queue must be "${this.config.queueName}"`);
    }
  }
}

class SqsPollingConsumer<TData> implements QueueConsumer {
  private closed = false;
  private polling?: Promise<void>;

  constructor(
    private readonly config: SqsQueueConfig,
    private readonly handler: QueueHandler<TData>,
    private readonly receiveMessage: SqsReceiveMessage,
    private readonly deleteMessage: SqsDeleteMessage,
    private readonly sleep: (milliseconds: number) => Promise<void>,
    private readonly onWorkerError: (queueName: string, error: Error) => void,
  ) {}

  start(): void {
    this.polling = this.poll();
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.polling;
  }

  private async poll(): Promise<void> {
    while (!this.closed) {
      try {
        const response = await this.receiveMessage({
          MaxNumberOfMessages: Math.min(this.config.workerConcurrency, 10),
          MessageSystemAttributeNames: ["ApproximateReceiveCount"],
          QueueUrl: this.config.queueUrl,
          VisibilityTimeout: this.config.visibilityTimeoutSeconds,
          WaitTimeSeconds: this.config.waitTimeSeconds,
        });
        await Promise.all((response.Messages ?? []).map((message) => this.handle(message)));
      } catch (error) {
        this.onWorkerError(this.config.queueName, toError(error));
        if (!this.closed) {
          await this.sleep(this.config.pollErrorDelayMilliseconds);
        }
      }
    }
  }

  private async handle(message: NonNullable<ReceiveMessageCommandOutput["Messages"]>[number]): Promise<void> {
    if (!message.Body || !message.MessageId || !message.ReceiptHandle) {
      throw new Error("SQS message is missing required fields");
    }

    const envelope = parseEnvelope(message.Body, this.config.queueName);
    const attemptsMade = Math.max(
      0,
      Number.parseInt(message.Attributes?.ApproximateReceiveCount ?? "1", 10) - 1,
    );
    await this.handler({
      attemptsMade,
      data: envelope.data as TData,
      id: envelope.jobId ?? message.MessageId,
      name: envelope.name,
    } satisfies QueueJob<TData>);
    await this.deleteMessage({
      QueueUrl: this.config.queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    });
  }
}

function parseEnvelope(body: string, queueName: string): SqsJobEnvelope {
  const parsed: unknown = JSON.parse(body);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("data" in parsed) ||
    !("name" in parsed) ||
    parsed.name !== queueName
  ) {
    throw new Error("SQS message has an invalid queue envelope");
  }

  return parsed as SqsJobEnvelope;
}

function validateEnqueueOptions(options: EnqueueOptions): void {
  if (
    options.delayMilliseconds !== undefined &&
    (!Number.isSafeInteger(options.delayMilliseconds) ||
      options.delayMilliseconds < 0 ||
      options.delayMilliseconds > 900_000)
  ) {
    throw new RangeError("SQS delayMilliseconds must be between 0 and 900000");
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("SQS queue worker failed");
}

function logWorkerError(queueName: string, error: Error): void {
  console.error(
    JSON.stringify({
      error: { name: error.name },
      event: "queue_worker_error",
      queue: queueName,
    }),
  );
}
