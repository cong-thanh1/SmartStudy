import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import { getAuthClaims, requireAuth } from "../../middleware/require-auth.js";
import type { IAuthProvider } from "../../ports/index.js";
import {
  attemptIdParamsSchema,
  examDocumentIdParamsSchema,
  examIdParamsSchema,
  generateExamRequestSchema,
  submitAttemptRequestSchema,
} from "./exam-schemas.js";
import type { IExamService } from "./exam-service.js";

export function createExamRouter(
  authProvider: IAuthProvider,
  examService: IExamService,
): Router {
  const router = Router();

  router.use(requireAuth(authProvider));

  router.post(
    "/documents/:documentId/exams",
    handle(async (request, response) => {
      const { documentId } = examDocumentIdParamsSchema.parse(request.params);
      const body = generateExamRequestSchema.parse(request.body);
      const claims = getAuthClaims(response);

      const exam = await examService.generateExam({
        documentId,
        userId: claims.sub,
        ...(body.difficultyDistribution === undefined
          ? {}
          : { difficultyDistribution: body.difficultyDistribution }),
        ...(body.numQuestions === undefined
          ? {}
          : { numQuestions: body.numQuestions }),
        ...(body.timeLimitMinutes === undefined
          ? {}
          : { timeLimitMinutes: body.timeLimitMinutes }),
      });

      response.status(201).json({ exam });
    }),
  );

  router.get(
    "/documents/:documentId/exams",
    handle(async (request, response) => {
      const { documentId } = examDocumentIdParamsSchema.parse(request.params);
      const claims = getAuthClaims(response);

      const exams = await examService.listExams({
        documentId,
        userId: claims.sub,
      });

      response.status(200).json({ exams });
    }),
  );

  router.get(
    "/exams/:examId",
    handle(async (request, response) => {
      const { examId } = examIdParamsSchema.parse(request.params);
      const mode = parseExamMode(request.query.mode);
      const claims = getAuthClaims(response);

      const exam = await examService.getExam({
        examId,
        mode,
        userId: claims.sub,
      });

      response.status(200).json({ exam });
    }),
  );

  router.post(
    "/exams/:examId/submit",
    handle(async (request, response) => {
      const { examId } = examIdParamsSchema.parse(request.params);
      const body = submitAttemptRequestSchema.parse(request.body);
      const claims = getAuthClaims(response);

      const attempt = await examService.submitAttempt({
        answers: body.answers,
        examId,
        userId: claims.sub,
      });

      response.status(201).json({ attempt });
    }),
  );

  router.post(
    "/quizzes/:quizId/submit",
    handle(async (request, response) => {
      const { quizId } = z.object({ quizId: z.string().uuid() }).parse(request.params);
      const body = submitAttemptRequestSchema.parse(request.body);
      const claims = getAuthClaims(response);

      const attempt = await examService.submitAttempt({
        answers: body.answers,
        quizId,
        userId: claims.sub,
      });

      response.status(201).json({ attempt });
    }),
  );

  router.get(
    "/exam-attempts/:attemptId",
    handle(async (request, response) => {
      const { attemptId } = attemptIdParamsSchema.parse(request.params);
      const claims = getAuthClaims(response);

      const attempt = await examService.getAttempt({
        attemptId,
        userId: claims.sub,
      });

      response.status(200).json({ attempt });
    }),
  );

  router.get(
    "/exams/:examId/attempts",
    handle(async (request, response) => {
      const { examId } = examIdParamsSchema.parse(request.params);
      const claims = getAuthClaims(response);

      const attempts = await examService.listAttempts(examId, claims.sub);

      response.status(200).json({ attempts });
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

function parseExamMode(value: unknown): "grade" | "review" | "take" {
  const candidate = Array.isArray(value) ? value[0] : value;
  const result = z.enum(["take", "review", "grade"]).safeParse(candidate);

  return result.success ? result.data : "take";
}
