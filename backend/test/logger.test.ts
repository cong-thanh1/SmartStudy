import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createRequestLogger } from "../src/middleware/request-logger.js";
import { Logger } from "../src/utils/logger.js";

describe("Logger utility", () => {
  it("logs info messages when minLevel is info", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger("info");

    logger.info("Test message", { key: "val" });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("Test message");
    expect(parsed.key).toBe("val");
    spy.mockRestore();
  });

  it("suppresses debug messages when minLevel is info", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger("info");

    logger.debug("Debug message");

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("RequestLogger middleware", () => {
  it("logs HTTP request details on finish", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = express();
    app.use(createRequestLogger());
    app.get("/test", (_req, res) => {
      res.locals.authClaims = { sub: "user-abc" };
      res.status(200).send("ok");
    });

    const response = await request(app).get("/test");

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(parsed.message).toBe("HTTP Request");
    expect(parsed.method).toBe("GET");
    expect(parsed.url).toBe("/test");
    expect(parsed.status).toBe(200);
    expect(parsed.userId).toBe("user-abc");
    spy.mockRestore();
  });
});
