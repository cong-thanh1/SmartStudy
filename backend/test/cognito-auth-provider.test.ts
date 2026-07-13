import type { InitiateAuthCommandOutput } from "@aws-sdk/client-cognito-identity-provider";
import { describe, expect, it, vi } from "vitest";

import type { CognitoAuthConfig } from "../src/adapters/auth/cognito-auth-config.js";
import {
  CognitoAuthProvider,
  type CognitoInitiateAuth,
  type CognitoSignUp,
} from "../src/adapters/auth/cognito-auth-provider.js";
import {
  EmailAlreadyRegisteredError,
  EmailConfirmationRequiredError,
  InvalidCredentialsError,
  InvalidTokenError,
} from "../src/modules/auth/auth-errors.js";

const now = new Date("2026-07-12T12:00:00.000Z");
const config: CognitoAuthConfig = {
  clientId: "client-id",
  refreshTokenTtlSeconds: 2_592_000,
  region: "us-east-1",
  userPoolId: "us-east-1_example",
};

const claims = {
  email: "student@example.com",
  email_verified: true,
  exp: 1_784_025_000,
  name: "Student",
  sub: "cognito-subject",
};

function authenticationResult(
  overrides: Partial<InitiateAuthCommandOutput> = {},
): InitiateAuthCommandOutput {
  return {
    $metadata: {},
    AuthenticationResult: {
      AccessToken: "cognito-access-token",
      ExpiresIn: 3_600,
      IdToken: "cognito-id-token",
      RefreshToken: "cognito-refresh-token",
      TokenType: "Bearer",
    },
    ...overrides,
  };
}

describe("CognitoAuthProvider", () => {
  it("registers an auto-confirmed user then creates a verified session", async () => {
    const signUp = vi.fn<CognitoSignUp>(async () => ({
      $metadata: {},
      UserConfirmed: true,
      UserSub: claims.sub,
    }));
    const initiateAuth = vi.fn<CognitoInitiateAuth>(async () =>
      authenticationResult(),
    );
    const provider = new CognitoAuthProvider(config, {
      initiateAuth,
      now: () => now,
      signUp,
      verifyIdToken: async () => claims,
    });

    await expect(
      provider.register({
        email: " Student@Example.COM ",
        fullName: " Student ",
        password: "a-strong-password",
      }),
    ).resolves.toEqual({
      tokens: {
        accessToken: "cognito-id-token",
        accessTokenExpiresAt: new Date(claims.exp * 1_000),
        refreshToken: "cognito-refresh-token",
        refreshTokenExpiresAt: new Date("2026-08-11T12:00:00.000Z"),
      },
      user: {
        email: claims.email,
        emailVerified: true,
        fullName: "Student",
        id: claims.sub,
        role: "student",
      },
    });
    expect(signUp).toHaveBeenCalledWith({
      ClientId: "client-id",
      Password: "a-strong-password",
      UserAttributes: [
        { Name: "email", Value: "student@example.com" },
        { Name: "name", Value: "Student" },
      ],
      Username: "student@example.com",
    });
    expect(initiateAuth).toHaveBeenCalledWith({
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        PASSWORD: "a-strong-password",
        USERNAME: "student@example.com",
      },
      ClientId: "client-id",
    });
  });

  it("requires an explicit confirmation flow when the pool does not auto-confirm", async () => {
    const provider = new CognitoAuthProvider(config, {
      signUp: async () => ({
        $metadata: {},
        UserConfirmed: false,
        UserSub: claims.sub,
      }),
      verifyIdToken: async () => claims,
    });

    await expect(
      provider.register({
        email: claims.email,
        password: "a-strong-password",
      }),
    ).rejects.toBeInstanceOf(EmailConfirmationRequiredError);
  });

  it("refreshes an ID token and retains Cognito's non-rotated refresh token", async () => {
    const initiateAuth = vi.fn<CognitoInitiateAuth>(async () =>
      authenticationResult({
        AuthenticationResult: {
          IdToken: "refreshed-id-token",
        },
      }),
    );
    const provider = new CognitoAuthProvider(config, {
      initiateAuth,
      now: () => now,
      verifyIdToken: async () => claims,
    });

    await expect(provider.refresh("existing-refresh-token")).resolves.toEqual({
      accessToken: "refreshed-id-token",
      accessTokenExpiresAt: new Date(claims.exp * 1_000),
      refreshToken: "existing-refresh-token",
      refreshTokenExpiresAt: new Date("2026-08-11T12:00:00.000Z"),
    });
    expect(initiateAuth).toHaveBeenCalledWith({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: "existing-refresh-token" },
      ClientId: "client-id",
    });
  });

  it("maps Cognito errors and verifies admin claims", async () => {
    const initiateAuth = vi.fn<CognitoInitiateAuth>(async () => {
      throw { name: "NotAuthorizedException" };
    });
    const provider = new CognitoAuthProvider(config, {
      initiateAuth,
      signUp: async () => {
        throw { name: "UsernameExistsException" };
      },
      verifyIdToken: async () => ({
        ...claims,
        "cognito:groups": ["admin"],
      }),
    });

    await expect(
      provider.login({ email: claims.email, password: "wrong" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      provider.register({ email: claims.email, password: "a-strong-password" }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    await expect(provider.verifyToken("id-token")).resolves.toEqual({
      email: claims.email,
      role: "admin",
      sub: claims.sub,
    });
  });

  it("rejects missing authentication results and invalid token claims", async () => {
    const provider = new CognitoAuthProvider(config, {
      initiateAuth: async () => authenticationResult({ AuthenticationResult: {} }),
      verifyIdToken: async () => ({ ...claims, exp: Number.NaN }),
    });

    await expect(
      provider.login({ email: claims.email, password: "a-strong-password" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(provider.verifyToken("id-token")).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it("revokes a refresh token through Cognito's OAuth revocation endpoint", async () => {
    const revokeToken = vi.fn(async () => undefined);
    const provider = new CognitoAuthProvider(config, {
      revokeToken,
      verifyIdToken: async () => claims,
    });

    await provider.revokeRefreshToken("refresh-token");
    expect(revokeToken).toHaveBeenCalledWith({
      ClientId: "client-id",
      Token: "refresh-token",
    });
  });
});
