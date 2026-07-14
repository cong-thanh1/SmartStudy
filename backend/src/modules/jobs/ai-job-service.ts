import { randomUUID } from "node:crypto";
import type { IQueueProvider } from "../../ports/index.js";
import type { GenerateExamInput, IExamService } from "../exam/exam-service.js";
import type { GenerateQuizInput, IQuizService } from "../quiz/quiz-service.js";
import type { AiJobKind, AiJobRecord, IAiJobRepository } from "./job-repository.js";

export interface AiGenerationJob { readonly jobId: string; readonly type: "ai-generation"; }

export class AiJobService {
  constructor(private readonly jobs: IAiJobRepository, private readonly queue: IQueueProvider, private readonly queueName: string) {}

  async submit(kind: AiJobKind, documentId: string, userId: string, input: Record<string, unknown>): Promise<AiJobRecord> {
    const id = randomUUID();
    const job = await this.jobs.create({ documentId, id, input, kind, ownerId: userId });
    await this.queue.enqueue(this.queueName, { jobId: id, type: "ai-generation" } satisfies AiGenerationJob, { attempts: 2, jobId: id });
    return job;
  }

  get(jobId: string, userId: string): Promise<AiJobRecord | null> { return this.jobs.findOwnedById(jobId, userId); }

  async process(jobId: string, quiz: IQuizService, exam: IExamService): Promise<void> {
    const job = await this.jobs.findOwnedById(jobId, "__worker__");
    if (!job) throw new Error("AI job was not found");
    await this.jobs.markRunning(jobId);
    try {
      const result = job.kind === "quiz"
        ? await quiz.generateQuiz({ documentId: job.documentId, userId: job.ownerId, ...job.input } as GenerateQuizInput)
        : await exam.generateExam({ documentId: job.documentId, userId: job.ownerId, ...job.input } as GenerateExamInput);
      await this.jobs.markCompleted(jobId, result.id);
    } catch (error) {
      await this.jobs.markFailed(jobId, error instanceof Error ? error.message : "AI generation failed");
      throw error;
    }
  }
}
