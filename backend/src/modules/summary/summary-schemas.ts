import { z } from "zod";

export const summaryDocumentIdParamsSchema = z
  .object({
    documentId: z.string().uuid(),
  })
  .strict();

export const getFullDocumentSummaryQuerySchema = z
  .object({
    scope: z.literal("full").optional(),
  })
  .strict();

export const summarizeFullDocumentSchema = z
  .object({
    forceRefresh: z.boolean().optional(),
    scope: z.literal("full").optional(),
  })
  .strict();
