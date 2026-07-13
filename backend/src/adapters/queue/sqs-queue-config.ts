import { z } from "zod";

const sqsQueueEnvironmentSchema = z.object({
  QUEUE_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(1),
  SQS_POLL_ERROR_DELAY_MILLISECONDS: z.coerce
    .number()
    .int()
    .min(100)
    .max(60_000)
    .default(1_000),
  SQS_QUEUE_NAME: z.string().trim().min(1).default("document-processing"),
  SQS_QUEUE_URL: z.string().trim().url(),
  SQS_VISIBILITY_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .min(0)
    .max(43_200)
    .default(120),
  SQS_WAIT_TIME_SECONDS: z.coerce.number().int().min(1).max(20).default(20),
});

export interface SqsQueueConfig {
  readonly pollErrorDelayMilliseconds: number;
  readonly queueName: string;
  readonly queueUrl: string;
  readonly visibilityTimeoutSeconds: number;
  readonly waitTimeSeconds: number;
  readonly workerConcurrency: number;
}

export function loadSqsQueueConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SqsQueueConfig {
  const parsed = sqsQueueEnvironmentSchema.parse(environment);

  return {
    pollErrorDelayMilliseconds: parsed.SQS_POLL_ERROR_DELAY_MILLISECONDS,
    queueName: parsed.SQS_QUEUE_NAME,
    queueUrl: parsed.SQS_QUEUE_URL,
    visibilityTimeoutSeconds: parsed.SQS_VISIBILITY_TIMEOUT_SECONDS,
    waitTimeSeconds: parsed.SQS_WAIT_TIME_SECONDS,
    workerConcurrency: parsed.QUEUE_WORKER_CONCURRENCY,
  };
}
