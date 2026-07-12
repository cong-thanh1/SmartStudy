import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { loadCognitoAuthConfig } from "../src/adapters/auth/cognito-auth-config.js";

describe("Cognito auth config", () => {
  it("loads explicit Cognito settings without credentials", () => {
    expect(
      loadCognitoAuthConfig({
        COGNITO_CLIENT_ID: "client-id",
        COGNITO_USER_POOL_ID: "us-east-1_example",
      }),
    ).toEqual({
      clientId: "client-id",
      refreshTokenTtlSeconds: 2_592_000,
      region: "us-east-1",
      userPoolId: "us-east-1_example",
    });
  });

  it.each([
    {},
    { COGNITO_CLIENT_ID: " ", COGNITO_USER_POOL_ID: "pool" },
    { COGNITO_CLIENT_ID: "client", COGNITO_USER_POOL_ID: " " },
    {
      COGNITO_CLIENT_ID: "client",
      COGNITO_REFRESH_TTL_SECONDS: "0",
      COGNITO_USER_POOL_ID: "pool",
    },
  ])("rejects invalid config %#", (environment) => {
    expect(() => loadCognitoAuthConfig(environment)).toThrow(ZodError);
  });
});
