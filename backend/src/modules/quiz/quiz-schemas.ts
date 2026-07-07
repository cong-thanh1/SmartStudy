import { z } from "zod";

export const quizDocumentIdParamsSchema = z
  .object({
    documentId: z.string().uuid(),
  })
  .strict();

export const quizIdParamsSchema = z
  .object({
    quizId: z.string().uuid(),
  })
  .strict();

export const generateQuizRequestSchema = z
  .object({
    chapterRef: z.string().trim().min(1).max(500).optional(),
    difficulty: z.enum(["easy", "hard", "medium"]).optional(),
    numQuestions: z.number().int().min(1).max(30).default(5),
  })
  .strict();

export const generatedQuizQuestionSchema = z
  .object({
    correct_answer: z.string().trim().min(1),
    explanation: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(4),
    question_id: z.string().trim().min(1),
    question_text: z.string().trim().min(1),
  })
  .strict();

export const generatedQuizSchema = z
  .object({
    questions: z.array(generatedQuizQuestionSchema).min(1),
  })
  .strict();

export type GeneratedQuiz = z.infer<typeof generatedQuizSchema>;
export type GeneratedQuizQuestion = z.infer<typeof generatedQuizQuestionSchema>;
