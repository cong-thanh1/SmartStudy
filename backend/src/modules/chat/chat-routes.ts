import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthClaims, requireAuth } from "../../middleware/require-auth.js";
import type { IAuthProvider } from "../../ports/index.js";
import {
  conversationIdParamsSchema,
  createConversationSchema,
  listConversationsQuerySchema,
  sendChatMessageSchema,
} from "./chat-schemas.js";
import type { IChatService } from "./chat-service.js";

export function createChatRouter(
  authProvider: IAuthProvider,
  chatService: IChatService,
): Router {
  const router = Router();

  router.use(requireAuth(authProvider));

  router.post(
    "/conversations",
    handle(async (request, response) => {
      const input = createConversationSchema.parse(request.body);
      const claims = getAuthClaims(response);
      const conversation = await chatService.createConversation({
        documentId: input.documentId,
        userId: claims.sub,
        ...(input.title === undefined ? {} : { title: input.title }),
      });

      response.status(201).json({
        conversation,
      });
    }),
  );

  router.get(
    "/conversations",
    handle(async (request, response) => {
      const { documentId } = listConversationsQuerySchema.parse(request.query);
      const conversations = await chatService.listConversations(documentId, getAuthClaims(response).sub);
      response.status(200).json({ conversations });
    }),
  );

  router.get(
    "/conversations/:conversationId/messages",
    handle(async (request, response) => {
      const { conversationId } = conversationIdParamsSchema.parse(request.params);
      const messages = await chatService.listMessages(conversationId, getAuthClaims(response).sub);
      response.status(200).json({ messages });
    }),
  );

  router.post(
    "/conversations/:conversationId/messages",
    handle(async (request, response) => {
      const { conversationId } = conversationIdParamsSchema.parse(
        request.params,
      );
      const input = sendChatMessageSchema.parse(request.body);
      const claims = getAuthClaims(response);
      const result = await chatService.sendMessage({
        content: input.content,
        conversationId,
        userId: claims.sub,
      });

      response.status(201).json(result);
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
