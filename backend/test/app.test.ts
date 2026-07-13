import request from "supertest";
import { describe, expect, it } from "vitest";

import type { IAuthProvider } from "../src/ports/index.js";
import { createTestApp } from "./test-app.js";

const authProvider = Object.freeze({}) as IAuthProvider;

describe("API health endpoint", () => {
  it("reports that the API is healthy", async () => {
    const response = await request(createTestApp(authProvider)).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: "smartstudy-api",
      status: "ok",
    });
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("accepts unauthenticated CORS preflight requests", async () => {
    const response = await request(createTestApp(authProvider))
      .options("/api/v1/documents")
      .set("Origin", "https://example.test");

    expect(response.status).toBe(204);
  });
});
