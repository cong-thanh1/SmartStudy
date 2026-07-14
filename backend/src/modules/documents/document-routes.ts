import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthClaims, requireAuth } from "../../middleware/require-auth.js";
import type { IAuthProvider } from "../../ports/index.js";
import type { DocumentConfig } from "./document-config.js";
import type { IDocumentService } from "./document-service.js";
import {
  completeDocumentUploadSchema,
  createDocumentUploadSchema,
  documentIdParamsSchema,
  listDocumentsQuerySchema,
} from "./document-schemas.js";

export function createDocumentRouter(
  authProvider: IAuthProvider,
  documentService: IDocumentService,
  config: DocumentConfig,
): Router {
  const router = Router();
  const uploadSchema = createDocumentUploadSchema(config.maxFileSizeBytes);

  router.use(requireAuth(authProvider));

  router.get(
    "/",
    handle(async (request, response) => {
      const query = listDocumentsQuerySchema.parse(request.query);
      const claims = getAuthClaims(response);
      const result = await documentService.listDocuments({
        limit: query.limit,
        page: query.page,
        userId: claims.sub,
        ...(query.search === undefined ? {} : { search: query.search }),
        ...(query.status === undefined ? {} : { status: query.status }),
      });

      response.status(200).json(result);
    }),
  );

  router.post(
    "/upload-url",
    handle(async (request, response) => {
      const input = uploadSchema.parse(request.body);
      const claims = getAuthClaims(response);
      const result = await documentService.requestUpload({
        ...input,
        userId: claims.sub,
      });

      response.status(201).json(result);
    }),
  );

  router.post(
    "/:documentId/complete",
    handle(async (request, response) => {
      completeDocumentUploadSchema.parse(request.body ?? {});
      const { documentId } = documentIdParamsSchema.parse(request.params);
      const claims = getAuthClaims(response);
      const document = await documentService.completeUpload(
        documentId,
        claims.sub,
      );

      response.status(document.status === "ready" ? 200 : 202).json({
        document,
      });
    }),
  );

  router.get(
    "/:documentId/preview",
    handle(async (request, response) => {
      const { documentId } = documentIdParamsSchema.parse(request.params);
      const claims = getAuthClaims(response);
      const preview = await documentService.getDocumentPreview(
        documentId,
        claims.sub,
      );

      response.status(200).json({ preview });
    }),
  );

  router.get(
    "/:documentId",
    handle(async (request, response) => {
      const { documentId } = documentIdParamsSchema.parse(request.params);
      const claims = getAuthClaims(response);
      const document = await documentService.getDocument(
        documentId,
        claims.sub,
      );

      response.status(200).json({
        document,
      });
    }),
  );

  router.delete(
    "/:documentId",
    handle(async (request, response) => {
      const { documentId } = documentIdParamsSchema.parse(request.params);
      const claims = getAuthClaims(response);

      await documentService.deleteDocument(documentId, claims.sub);

      response.status(204).send();
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
