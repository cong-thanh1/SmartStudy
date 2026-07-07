import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthClaims, requireAuth } from "../../middleware/require-auth.js";
import type { IAuthProvider } from "../../ports/index.js";
import { SummaryNotFoundError } from "./summary-errors.js";
import {
  getSummaryQuerySchema,
  summarizeRequestSchema,
  summaryDocumentIdParamsSchema,
} from "./summary-schemas.js";
import type { ISummaryService } from "./summary-service.js";

export function createSummaryRouter(
  authProvider: IAuthProvider,
  summaryService: ISummaryService,
): Router {
  const router = Router();

  router.use(requireAuth(authProvider));

  router.get(
    "/:documentId/summary",
    handle(async (request, response) => {
      const query = getSummaryQuerySchema.parse(request.query);
      const { documentId } = summaryDocumentIdParamsSchema.parse(
        request.params,
      );
      const claims = getAuthClaims(response);
      const summary =
        query.scope === "chapter"
          ? await summaryService.getChapterSummary({
              chapterRef: requireChapterRef(query.chapterRef),
              documentId,
              userId: claims.sub,
            })
          : await summaryService.getFullDocumentSummary({
              documentId,
              userId: claims.sub,
            });

      if (!summary) {
        throw new SummaryNotFoundError();
      }

      response.status(200).json({
        summary,
      });
    }),
  );

  router.post(
    "/:documentId/summary",
    handle(async (request, response) => {
      const { documentId } = summaryDocumentIdParamsSchema.parse(
        request.params,
      );
      const body = summarizeRequestSchema.parse(request.body ?? {});
      const claims = getAuthClaims(response);
      const summary =
        body.scope === "chapter"
          ? await summaryService.summarizeChapter({
              chapterRef: body.chapterRef,
              documentId,
              userId: claims.sub,
              ...(body.forceRefresh === undefined
                ? {}
                : { forceRefresh: body.forceRefresh }),
            })
          : await summaryService.summarizeFullDocument({
              documentId,
              userId: claims.sub,
              ...(body.forceRefresh === undefined
                ? {}
                : { forceRefresh: body.forceRefresh }),
            });

      response.status(200).json({
        summary,
      });
    }),
  );

  return router;
}

function requireChapterRef(chapterRef: string | undefined): string {
  if (chapterRef === undefined) {
    throw new Error("chapterRef is required for chapter summaries");
  }

  return chapterRef;
}

type AsyncRouteHandler = (
  request: Request,
  response: Response,
) => Promise<void>;

function handle(handler: AsyncRouteHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response).catch(next);
  };
}
