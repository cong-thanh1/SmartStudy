import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthClaims, requireAuth } from "../../middleware/require-auth.js";
import type { IAuthProvider } from "../../ports/index.js";
import {
  generateQuizRequestSchema,
  quizDocumentIdParamsSchema,
  quizIdParamsSchema,
} from "./quiz-schemas.js";
import type { IQuizService } from "./quiz-service.js";

export function createQuizRouter(
  authProvider: IAuthProvider,
  quizService: IQuizService,
): Router {
  const router = Router();

  router.use(requireAuth(authProvider));

  router.post(
    "/documents/:documentId/quizzes",
    handle(async (request, response) => {
      const { documentId } = quizDocumentIdParamsSchema.parse(request.params);
      const body = generateQuizRequestSchema.parse(request.body);
      const claims = getAuthClaims(response);

      const quiz = await quizService.generateQuiz({
        chapterRef: body.chapterRef,
        difficulty: body.difficulty,
        documentId,
        numQuestions: body.numQuestions,
        userId: claims.sub,
      });

      response.status(201).json({ quiz });
    }),
  );

  router.get(
    "/documents/:documentId/quizzes",
    handle(async (request, response) => {
      const { documentId } = quizDocumentIdParamsSchema.parse(request.params);
      const claims = getAuthClaims(response);

      const quizzes = await quizService.listQuizzes({
        documentId,
        userId: claims.sub,
      });

      response.status(200).json({ quizzes });
    }),
  );

  router.get(
    "/quizzes/:quizId",
    handle(async (request, response) => {
      const { quizId } = quizIdParamsSchema.parse(request.params);
      const claims = getAuthClaims(response);

      const quiz = await quizService.getQuiz({
        quizId,
        userId: claims.sub,
      });

      response.status(200).json({ quiz });
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
