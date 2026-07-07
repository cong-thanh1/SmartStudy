import type { RequestHandler } from "express";

import { logger } from "../utils/logger.js";

export function createRequestLogger(): RequestHandler {
  return (request, response, next): void => {
    const start = Date.now();

    response.on("finish", () => {
      const durationMs = Date.now() - start;
      const authClaims = response.locals.authClaims as
        | { readonly sub?: string }
        | undefined;
      const userId = authClaims?.sub ?? "anonymous";

      logger.info("HTTP Request", {
        durationMs,
        method: request.method,
        status: response.statusCode,
        url: request.originalUrl || request.url,
        userId,
      });
    });

    next();
  };
}
