import { z } from "zod";

export const createConversationSchema = z
  .object({
    documentId: z.string().uuid(),
    title: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const conversationIdParamsSchema = z
  .object({
    conversationId: z.string().uuid(),
  })
  .strict();

export const sendChatMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(4_000),
  })
  .strict();
