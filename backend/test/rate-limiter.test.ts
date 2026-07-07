import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createRateLimiter,
  RateLimiterStore,
} from "../src/middleware/rate-limiter.js";

function createTestApp(store: RateLimiterStore, maxRequests = 2) {
  const app = express();
  app.use(express.json());

  // Dummy auth middleware simulation
  app.use((req, res, next) => {
    const userId = req.header("X-Test-User");
    if (userId) {
      res.locals.authClaims = { sub: userId };
    }
    next();
  });

  app.use(createRateLimiter({ maxRequests, windowMs: 60_000 }, store));

  app.get("/test", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return app;
}

describe("RateLimiter middleware", () => {
  let store: RateLimiterStore;

  beforeEach(() => {
    store = new RateLimiterStore();
  });

  it("allows requests within limit and sets headers", async () => {
    const app = createTestApp(store, 2);

    const res1 = await request(app)
      .get("/test")
      .set("X-Test-User", "user-1");

    expect(res1.status).toBe(200);
    expect(res1.header["x-ratelimit-limit"]).toBe("2");
    expect(res1.header["x-ratelimit-remaining"]).toBe("1");
  });

  it("returns 429 when rate limit is exceeded for a user", async () => {
    const app = createTestApp(store, 2);

    await request(app).get("/test").set("X-Test-User", "user-1");
    await request(app).get("/test").set("X-Test-User", "user-1");
    const res3 = await request(app)
      .get("/test")
      .set("X-Test-User", "user-1");

    expect(res3.status).toBe(429);
    expect(res3.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(res3.header["retry-after"]).toBeDefined();
  });

  it("limits users independently", async () => {
    const app = createTestApp(store, 1);

    const res1 = await request(app)
      .get("/test")
      .set("X-Test-User", "user-A");
    const res2 = await request(app)
      .get("/test")
      .set("X-Test-User", "user-B");
    const res3 = await request(app)
      .get("/test")
      .set("X-Test-User", "user-A");

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(429);
  });

  it("falls back to IP when unauthenticated", async () => {
    const app = createTestApp(store, 1);

    const res1 = await request(app).get("/test");
    const res2 = await request(app).get("/test");

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(429);
  });
});
