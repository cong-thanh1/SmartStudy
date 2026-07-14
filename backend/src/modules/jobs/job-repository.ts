export type AiJobKind = "quiz" | "exam";
export type AiJobStatus = "queued" | "running" | "completed" | "failed";

export interface AiJobRecord {
  readonly createdAt: Date;
  readonly documentId: string;
  readonly errorMessage: string | null;
  readonly id: string;
  readonly input: Record<string, unknown>;
  readonly kind: AiJobKind;
  readonly ownerId: string;
  readonly resultId: string | null;
  readonly status: AiJobStatus;
  readonly updatedAt: Date;
}

export interface IAiJobRepository {
  create(input: Omit<AiJobRecord, "createdAt" | "errorMessage" | "resultId" | "status" | "updatedAt">): Promise<AiJobRecord>;
  findOwnedById(jobId: string, ownerId: string): Promise<AiJobRecord | null>;
  markCompleted(jobId: string, resultId: string): Promise<void>;
  markFailed(jobId: string, message: string): Promise<void>;
  markRunning(jobId: string): Promise<void>;
}
