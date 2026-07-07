import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthClaims, requireAuth } from "../../middleware/require-auth.js";
import type { IAuthProvider } from "../../ports/index.js";
import { SummaryNotFoundError } from "./summary-errors.js";
import {
  getFullDocumentSummaryQuerySchema,
  summarizeFullDocumentSchema,
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
      getFullDocumentSummaryQuerySchema.parse(request.query);
      const { documentId } = summaryDocumentIdParamsSchema.parse(
        request.params,
      );
      const claims = getAuthClaims(response);
      const summary = await summaryService.getFullDocumentSummary({
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
      const body = summarizeFullDocumentSchema.parse(request.body ?? {});
      const claims = getAuthClaims(response);
      const summary = await summaryService.summarizeFullDocument({
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

type AsyncRouteHandler = (
  request: Request,
  response: Response,
) => Promise<void>;

function handle(handler: AsyncRouteHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response).catch(next);
  };
}
