import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import type { AuthSession, AuthTokens, IAuthProvider, IUserProfileProvider } from "../src/ports/index.js";
import { createTestApp } from "./test-app.js";

const user = { email: "student@example.com", emailVerified: true, fullName: "Student", id: "user-id", role: "student" as const };
const tokens: AuthTokens = { accessToken: "access", accessTokenExpiresAt: new Date(), refreshToken: "refresh", refreshTokenExpiresAt: new Date() };
const session: AuthSession = { tokens, user };
const authProvider: IAuthProvider = {
  login: vi.fn(async () => session), refresh: vi.fn(async () => tokens), register: vi.fn(async () => session),
  revokeRefreshToken: vi.fn(async () => undefined), verifyToken: vi.fn(async () => ({ email: user.email, role: user.role, sub: user.id })),
};

function profileProvider(): IUserProfileProvider {
  return {
    getProfile: vi.fn(async () => user),
    updateProfile: vi.fn(async (_claims, input) => ({ ...user, fullName: input.fullName })),
  };
}

describe("profile routes", () => {
  it("requires authentication", async () => {
    const response = await request(createTestApp(authProvider, undefined, undefined, undefined, undefined, undefined, undefined, profileProvider())).get("/api/v1/profile/me");
    expect(response.status).toBe(401);
  });
  it("reads and validates updates", async () => {
    const provider = profileProvider();
    const app = createTestApp(authProvider, undefined, undefined, undefined, undefined, undefined, undefined, provider);
    const fetched = await request(app).get("/api/v1/profile/me").set("Authorization", "Bearer access");
    expect(fetched.status).toBe(200);
    const invalid = await request(app).patch("/api/v1/profile/me").set("Authorization", "Bearer access").send({ fullName: "   " });
    expect(invalid.status).toBe(400);
    const updated = await request(app).patch("/api/v1/profile/me").set("Authorization", "Bearer access").send({ fullName: " Updated " });
    expect(updated.status).toBe(200);
    expect(updated.body.user.fullName).toBe("Updated");
  });
});
