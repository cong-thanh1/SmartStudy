import { z } from "zod";

export const tutorAskRequestSchema = z
  .object({
    documentId: z.string().uuid().optional(),
    history: z
      .array(
        z
          .object({
            content: z.string(),
            role: z.enum(["assistant", "user"]),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    question: z.string().trim().min(1).max(2000),
    topic: z.string().trim().max(200).optional(),
  })
  .strict();

export type TutorAskRequest = z.infer<typeof tutorAskRequestSchema>;
