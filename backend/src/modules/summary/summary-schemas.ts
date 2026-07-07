import { z } from "zod";

export const summaryDocumentIdParamsSchema = z
  .object({
    documentId: z.string().uuid(),
  })
  .strict();

export const getSummaryQuerySchema = z
  .object({
    chapterRef: z.string().trim().min(1).max(500).optional(),
    scope: z.enum(["chapter", "full"]).default("full"),
  })
  .strict()
  .refine(
    (query) =>
      query.scope === "chapter"
        ? query.chapterRef !== undefined
        : query.chapterRef === undefined,
    {
      message: "chapterRef is only valid when scope is chapter",
      path: ["chapterRef"],
    },
  );

const summarizeFullDocumentSchema = z
  .object({
    forceRefresh: z.boolean().optional(),
    scope: z.literal("full").optional(),
  })
  .strict();

const summarizeChapterSchema = z
  .object({
    chapterRef: z.string().trim().min(1).max(500),
    forceRefresh: z.boolean().optional(),
    scope: z.literal("chapter"),
  })
  .strict();

export const summarizeRequestSchema = z.union([
  summarizeChapterSchema,
  summarizeFullDocumentSchema,
]);
