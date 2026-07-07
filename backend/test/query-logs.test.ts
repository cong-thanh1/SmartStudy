import { describe, expect, it } from "vitest";

import { parseArgs } from "../scripts/query-logs.js";

describe("query-logs script", () => {
  it("parses CLI arguments correctly", () => {
    const args = [
      "--file",
      "logs/app.log",
      "--level",
      "error",
      "--userId",
      "user-123",
      "--status",
      "500",
      "--keyword",
      "timeout",
      "--limit",
      "10",
    ];

    const parsed = parseArgs(args);

    expect(parsed).toEqual({
      file: "logs/app.log",
      keyword: "timeout",
      level: "error",
      limit: 10,
      status: 500,
      userId: "user-123",
    });
  });
});
