import { describe, expect, it } from "vitest";

import { isAuthorized, parseAgentResponse } from "../src/protocol";

describe("relay protocol", () => {
  it("compares credentials without accepting prefixes", () => {
    expect(isAuthorized("secret-value", "secret-value")).toBe(true);
    expect(isAuthorized("secret", "secret-value")).toBe(false);
    expect(isAuthorized(null, "secret-value")).toBe(false);
  });

  it("accepts a valid agent response", () => {
    expect(parseAgentResponse({
      body: "{}",
      contentType: "application/json",
      id: "request-1",
      status: 200,
      type: "response",
    })).toEqual({
      body: "{}",
      contentType: "application/json",
      id: "request-1",
      status: 200,
      type: "response",
    });
  });

  it("rejects malformed response status values", () => {
    expect(parseAgentResponse({
      body: "{}",
      contentType: "application/json",
      id: "request-1",
      status: 999,
      type: "response",
    })).toBeNull();
  });
});
