import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AuthError } from "../modules/auth/auth-errors.js";
import { ChatError } from "../modules/chat/chat-errors.js";
import { DocumentError } from "../modules/documents/document-errors.js";
import { SummaryError } from "../modules/summary/summary-errors.js";
import { ProviderConfigurationError } from "../provider-errors.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  void _next;

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        details: error.issues.map((issue) => ({
          message: issue.message,
          path: issue.path.join("."),
        })),
        message: "Request validation failed",
      },
    });
    return;
  }

  if (error instanceof AuthError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  if (error instanceof DocumentError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  if (error instanceof ChatError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  if (error instanceof SummaryError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  if (error instanceof ProviderConfigurationError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
};
