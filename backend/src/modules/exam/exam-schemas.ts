import { z } from "zod";

export const examDocumentIdParamsSchema = z
  .object({
    documentId: z.string().uuid(),
  })
  .strict();

export const examIdParamsSchema = z
  .object({
    examId: z.string().uuid(),
  })
  .strict();

export const attemptIdParamsSchema = z
  .object({
    attemptId: z.string().uuid(),
  })
  .strict();

export const generateExamRequestSchema = z
  .object({
    difficultyDistribution: z
      .record(
        z.enum(["easy", "hard", "medium"]),
        z.number().int().min(0).max(100),
      )
      .optional(),
    numQuestions: z.number().int().min(1).max(50).default(10),
    timeLimitMinutes: z.number().int().min(1).max(180).optional(),
  })
  .strict();

export const generatedExamQuestionSchema = z
  .object({
    correct_answer: z.string().trim().min(1),
    difficulty: z.enum(["easy", "hard", "medium"]).optional(),
    explanation: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(4),
    question_id: z.string().trim().min(1),
    question_text: z.string().trim().min(1),
  })
  .strict();

export const generatedExamSchema = z
  .object({
    questions: z.array(generatedExamQuestionSchema).min(1),
  })
  .strict();

export const submitAttemptRequestSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            question_id: z.string().trim().min(1),
            selected_answer: z.string().trim(),
          })
          .strict(),
      )
      .min(1),
    quizId: z.string().uuid().optional(),
  })
  .strict();

export type GeneratedExamQuestion = z.infer<typeof generatedExamQuestionSchema>;
export type GeneratedExam = z.infer<typeof generatedExamSchema>;
