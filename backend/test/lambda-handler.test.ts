import express from "express";
import { describe, expect, it, vi } from "vitest";

const { configure } = vi.hoisted(() => ({
  configure: vi.fn(() => "lambda-handler"),
}));

vi.mock("@codegenie/serverless-express", () => ({ configure }));

import { createLambdaHandler } from "../src/lambda-handler.js";

describe("createLambdaHandler", () => {
  it("adapts the existing Express application for Lambda", () => {
    const app = express();

    expect(createLambdaHandler(app)).toBe("lambda-handler");
    expect(configure).toHaveBeenCalledWith({ app });
  });
});
