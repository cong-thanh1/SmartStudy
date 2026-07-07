import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthClaims, requireAuth } from "../../middleware/require-auth.js";
import type { IAuthProvider } from "../../ports/index.js";
import { tutorAskRequestSchema } from "./tutor-schemas.js";
import type { ITutorService } from "./tutor-service.js";

export function createTutorRouter(
  authProvider: IAuthProvider,
  tutorService: ITutorService,
): Router {
  const router = Router();

  router.use(requireAuth(authProvider));

  router.post(
    "/tutor/ask",
    handle(async (request, response) => {
      const body = tutorAskRequestSchema.parse(request.body);
      const claims = getAuthClaims(response);

      const result = await tutorService.ask({
        documentId: body.documentId,
        history: body.history,
        question: body.question,
        topic: body.topic,
        userId: claims.sub,
      });

      response.status(200).json(result);
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
