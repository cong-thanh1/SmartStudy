import express, { type Express } from "express";

import { errorHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./modules/auth/auth-routes.js";
import { createChatRouter } from "./modules/chat/chat-routes.js";
import type { IChatService } from "./modules/chat/chat-service.js";
import type { DocumentConfig } from "./modules/documents/document-config.js";
import { createDocumentRouter } from "./modules/documents/document-routes.js";
import type { IDocumentService } from "./modules/documents/document-service.js";
import type { IAuthProvider } from "./ports/index.js";

export interface AppDependencies {
  readonly authProvider: IAuthProvider;
  readonly chatService: IChatService;
  readonly documentConfig: DocumentConfig;
  readonly documentService: IDocumentService;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.status(200).json({
      service: "smartstudy-api",
      status: "ok",
    });
  });

  app.use("/api/v1/auth", createAuthRouter(dependencies.authProvider));
  app.use(
    "/api/v1/chat",
    createChatRouter(dependencies.authProvider, dependencies.chatService),
  );
  app.use(
    "/api/v1/documents",
    createDocumentRouter(
      dependencies.authProvider,
      dependencies.documentService,
      dependencies.documentConfig,
    ),
  );
  app.use(errorHandler);

  return app;
}
