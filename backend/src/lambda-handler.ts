import { configure } from "@codegenie/serverless-express";
import type { Express } from "express";

export function createLambdaHandler(app: Express) {
  return configure({ app });
}
