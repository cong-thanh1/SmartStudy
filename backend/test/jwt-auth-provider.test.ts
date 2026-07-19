import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IPasswordHasher } from "../src/adapters/auth/bcrypt-password-hasher.js";
import type { JwtAuthConfig } from "../src/adapters/auth/jwt-auth-config.js";
import {
  hashRefreshToken,
  JwtAuthProvider,
} from "../src/adapters/auth/jwt-auth-provider.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidTokenError,
  WeakPasswordError,
} from "../src/modules/auth/auth-errors.js";
import {
  EmailAlreadyExistsRepositoryError,
  type AuthUserRecord,
  type IAuthRepository,
  type RefreshTokenRecord,
} from "../src/modules/auth/auth-repository.js";

const now = new Date("2026-07-04T07:00:00.000Z");
const config: JwtAuthConfig = {
  accessTokenTtlSeconds: 900,
  audience: "smartstudy-web",
  bcryptCost: 12,
  issuer: "smartstudy-api",
  refreshTokenTtlSeconds: 2_592_000,
  secret: "test-secret-with-at-least-32-characters",
};
const user: AuthUserRecord = {
  email: "student@example.com",
  emailVerified: false,
  fullName: "Student",
  id: "8f64e18f-7c3b-4bc9-9d15-9f578fa03a19",
  passwordHash: "hashed-password",
  role: "student",
};

function createRepository(): IAuthRepository {
  return {
    createUser: vi.fn(async () => user),
    findRefreshToken: vi.fn(async () => null),
    findUserByEmail: vi.fn(async () => null),
    findUserById: vi.fn(async () => null),
    revokeRefreshToken: vi.fn(async () => undefined),
    rotateRefreshToken: vi.fn(async () => true),
    saveRefreshToken: vi.fn(async () => undefined),
    updateUserFullName: vi.fn(async () => null),
  };
}

function createPasswordHasher(): IPasswordHasher {
  return {
    compare: vi.fn(async () => true),
    hash: vi.fn(async () => "hashed-password"),
  };
}

function createProvider(
  repository: IAuthRepository,
  passwordHasher = createPasswordHasher(),
): JwtAuthProvider {
  let tokenSequence = 0;

  return new JwtAuthProvider(repository, passwordHasher, config, {
    generateRefreshToken: () => `refresh-token-${++tokenSequence}`,
    now: () => now,
  });
}

describe("JwtAuthProvider", () => {
  let repository: IAuthRepository;
  let passwordHasher: IPasswordHasher;

  beforeEach(() => {
    repository = createRepository();
    passwordHasher = createPasswordHasher();
  });

  it("registers a normalized user and stores only the refresh hash", async () => {
    const provider = createProvider(repository, passwordHasher);

    const session = await provider.register({
      email: "  Student@Example.COM ",
      fullName: " Student ",
      password: "a-strong-password",
    });

    expect(repository.findUserByEmail).toHaveBeenCalledWith(
      "student@example.com",
    );
    expect(passwordHasher.hash).toHaveBeenCalledWith("a-strong-password");
    expect(repository.createUser).toHaveBeenCalledWith({
      email: "student@example.com",
      fullName: "Student",
      passwordHash: "hashed-password",
    });
    expect(repository.saveRefreshToken).toHaveBeenCalledWith({
      expiresAt: new Date("2026-08-03T07:00:00.000Z"),
      tokenHash: hashRefreshToken("refresh-token-1"),
      userId: user.id,
    });
    expect(session.tokens.refreshToken).toBe("refresh-token-1");
    expect(session.user).toEqual({
      email: user.email,
      emailVerified: false,
      fullName: "Student",
      id: user.id,
      role: "student",
    });
    await expect(
      provider.verifyToken(session.tokens.accessToken),
    ).resolves.toEqual({
      email: user.email,
      role: "student",
      sub: user.id,
    });
  });

  it("rejects weak passwords before accessing the database", async () => {
    const provider = createProvider(repository, passwordHasher);

    await expect(
      provider.register({
        email: user.email,
        password: "short",
      }),
    ).rejects.toBeInstanceOf(WeakPasswordError);
    expect(repository.findUserByEmail).not.toHaveBeenCalled();
  });

  it("rejects an email that already exists", async () => {
    vi.mocked(repository.findUserByEmail).mockResolvedValue(user);

    await expect(
      createProvider(repository).register({
        email: user.email,
        password: "a-strong-password",
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it("maps a concurrent unique-email conflict", async () => {
    vi.mocked(repository.createUser).mockRejectedValue(
      new EmailAlreadyExistsRepositoryError(),
    );

    await expect(
      createProvider(repository).register({
        email: user.email,
        password: "a-strong-password",
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it("does not hide unexpected registration failures", async () => {
    const failure = new Error("database unavailable");
    vi.mocked(repository.createUser).mockRejectedValue(failure);

    await expect(
      createProvider(repository).register({
        email: user.email,
        password: "a-strong-password",
      }),
    ).rejects.toBe(failure);
  });

  it("logs in with a matching password", async () => {
    vi.mocked(repository.findUserByEmail).mockResolvedValue(user);
    const provider = createProvider(repository, passwordHasher);

    const session = await provider.login({
      email: "STUDENT@example.com",
      password: "a-strong-password",
    });

    expect(passwordHasher.compare).toHaveBeenCalledWith(
      "a-strong-password",
      user.passwordHash,
    );
    expect(session.user.id).toBe(user.id);
  });

  it("uses the same generic error for unknown users and bad passwords", async () => {
    const provider = createProvider(repository, passwordHasher);

    await expect(
      provider.login({ email: user.email, password: "wrong" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    vi.mocked(repository.findUserByEmail).mockResolvedValue(user);
    vi.mocked(passwordHasher.compare).mockResolvedValue(false);

    await expect(
      provider.login({ email: user.email, password: "wrong" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("rotates a valid refresh token", async () => {
    const current: RefreshTokenRecord = {
      expiresAt: new Date("2026-07-05T07:00:00.000Z"),
      revokedAt: null,
      tokenHash: hashRefreshToken("current-refresh-token"),
      user,
    };
    vi.mocked(repository.findRefreshToken).mockResolvedValue(current);
    const provider = createProvider(repository);

    const tokens = await provider.refresh("current-refresh-token");

    expect(repository.rotateRefreshToken).toHaveBeenCalledWith({
      currentTokenHash: hashRefreshToken("current-refresh-token"),
      expiresAt: new Date("2026-08-03T07:00:00.000Z"),
      rotatedAt: now,
      tokenHash: hashRefreshToken("refresh-token-1"),
      userId: user.id,
    });
    expect(tokens.refreshToken).toBe("refresh-token-1");
  });

  it.each([
    null,
    {
      expiresAt: new Date("2026-07-05T07:00:00.000Z"),
      revokedAt: now,
      tokenHash: "revoked",
      user,
    },
    {
      expiresAt: now,
      revokedAt: null,
      tokenHash: "expired",
      user,
    },
  ])("rejects a missing, revoked, or expired refresh token", async (record) => {
    vi.mocked(repository.findRefreshToken).mockResolvedValue(record);

    await expect(
      createProvider(repository).refresh("invalid-refresh-token"),
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("rejects a refresh token that loses a rotation race", async () => {
    vi.mocked(repository.findRefreshToken).mockResolvedValue({
      expiresAt: new Date("2026-07-05T07:00:00.000Z"),
      revokedAt: null,
      tokenHash: "current",
      user,
    });
    vi.mocked(repository.rotateRefreshToken).mockResolvedValue(false);

    await expect(
      createProvider(repository).refresh("current"),
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("hashes refresh tokens before revocation", async () => {
    await createProvider(repository).revokeRefreshToken("raw-refresh-token");

    expect(repository.revokeRefreshToken).toHaveBeenCalledWith(
      hashRefreshToken("raw-refresh-token"),
      now,
    );
  });

  it("rejects malformed access tokens and claims", async () => {
    const provider = createProvider(repository);
    const tokenWithoutRole = jwt.sign(
      {
        email: user.email,
        iat: Math.floor(now.getTime() / 1000),
      },
      config.secret,
      {
        audience: config.audience,
        expiresIn: config.accessTokenTtlSeconds,
        issuer: config.issuer,
        subject: user.id,
      },
    );

    await expect(provider.verifyToken("malformed")).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
    await expect(
      provider.verifyToken(tokenWithoutRole),
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });
});
