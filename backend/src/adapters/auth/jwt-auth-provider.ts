import { createHash, randomBytes } from "node:crypto";

import jwt, { type JwtPayload } from "jsonwebtoken";

import type {
  AuthClaims,
  AuthSession,
  AuthTokens,
  AuthUser,
  IAuthProvider,
  IUserProfileProvider,
  LoginInput,
  RegisterInput,
  UpdateUserProfileInput,
  UserRole,
} from "../../ports/index.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidTokenError,
  WeakPasswordError,
} from "../../modules/auth/auth-errors.js";
import {
  EmailAlreadyExistsRepositoryError,
  type AuthUserRecord,
  type IAuthRepository,
} from "../../modules/auth/auth-repository.js";
import type { IPasswordHasher } from "./bcrypt-password-hasher.js";
import type { JwtAuthConfig } from "./jwt-auth-config.js";

export interface JwtAuthProviderDependencies {
  readonly generateRefreshToken?: () => string;
  readonly now?: () => Date;
}

interface TokenMaterial {
  readonly refreshTokenHash: string;
  readonly tokens: AuthTokens;
}

export class JwtAuthProvider implements IAuthProvider, IUserProfileProvider {
  private readonly generateRefreshToken: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly repository: IAuthRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly config: JwtAuthConfig,
    dependencies: JwtAuthProviderDependencies = {},
  ) {
    this.generateRefreshToken =
      dependencies.generateRefreshToken ??
      (() => randomBytes(48).toString("base64url"));
    this.now = dependencies.now ?? (() => new Date());
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    const email = normalizeEmail(input.email);

    if (input.password.length < 12) {
      throw new WeakPasswordError();
    }

    if (await this.repository.findUserByEmail(email)) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    let user: AuthUserRecord;

    try {
      user = await this.repository.createUser({
        email,
        passwordHash,
        ...(input.fullName ? { fullName: input.fullName.trim() } : {}),
      });
    } catch (error) {
      if (error instanceof EmailAlreadyExistsRepositoryError) {
        throw new EmailAlreadyRegisteredError();
      }

      throw error;
    }

    return this.createSession(user);
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const user = await this.repository.findUserByEmail(
      normalizeEmail(input.email),
    );

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    return this.createSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const currentTokenHash = hashRefreshToken(refreshToken);
    const currentToken =
      await this.repository.findRefreshToken(currentTokenHash);
    const now = this.now();

    if (
      !currentToken ||
      currentToken.revokedAt ||
      currentToken.expiresAt <= now
    ) {
      throw new InvalidTokenError();
    }

    const tokenMaterial = this.createTokenMaterial(currentToken.user, now);
    const rotated = await this.repository.rotateRefreshToken({
      currentTokenHash,
      expiresAt: tokenMaterial.tokens.refreshTokenExpiresAt,
      rotatedAt: now,
      tokenHash: tokenMaterial.refreshTokenHash,
      userId: currentToken.user.id,
    });

    if (!rotated) {
      throw new InvalidTokenError();
    }

    return tokenMaterial.tokens;
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await this.repository.revokeRefreshToken(
      hashRefreshToken(refreshToken),
      this.now(),
    );
  }

  async verifyToken(accessToken: string): Promise<AuthClaims> {
    try {
      const payload = jwt.verify(accessToken, this.config.secret, {
        algorithms: ["HS256"],
        audience: this.config.audience,
        clockTimestamp: Math.floor(this.now().getTime() / 1000),
        issuer: this.config.issuer,
      });

      if (!isAuthClaims(payload)) {
        throw new InvalidTokenError();
      }

      return {
        email: payload.email,
        role: payload.role,
        sub: payload.sub,
      };
    } catch {
      throw new InvalidTokenError();
    }
  }

  async getProfile(claims: AuthClaims): Promise<AuthUser> {
    const user = await this.repository.findUserById(claims.sub);
    if (!user) throw new InvalidTokenError();
    return toAuthUser(user);
  }

  async updateProfile(
    claims: AuthClaims,
    input: UpdateUserProfileInput,
  ): Promise<AuthUser> {
    const user = await this.repository.updateUserFullName(
      claims.sub,
      input.fullName.trim(),
    );
    if (!user) throw new InvalidTokenError();
    return toAuthUser(user);
  }

  private async createSession(user: AuthUserRecord): Promise<AuthSession> {
    const now = this.now();
    const tokenMaterial = this.createTokenMaterial(user, now);

    await this.repository.saveRefreshToken({
      expiresAt: tokenMaterial.tokens.refreshTokenExpiresAt,
      tokenHash: tokenMaterial.refreshTokenHash,
      userId: user.id,
    });

    return {
      tokens: tokenMaterial.tokens,
      user: toAuthUser(user),
    };
  }

  private createTokenMaterial(
    user: AuthUserRecord,
    now: Date,
  ): TokenMaterial {
    const issuedAt = Math.floor(now.getTime() / 1000);
    const accessToken = jwt.sign(
      {
        email: user.email,
        iat: issuedAt,
        role: user.role,
      },
      this.config.secret,
      {
        algorithm: "HS256",
        audience: this.config.audience,
        expiresIn: this.config.accessTokenTtlSeconds,
        issuer: this.config.issuer,
        subject: user.id,
      },
    );
    const refreshToken = this.generateRefreshToken();

    return {
      refreshTokenHash: hashRefreshToken(refreshToken),
      tokens: {
        accessToken,
        accessTokenExpiresAt: addSeconds(
          now,
          this.config.accessTokenTtlSeconds,
        ),
        refreshToken,
        refreshTokenExpiresAt: addSeconds(
          now,
          this.config.refreshTokenTtlSeconds,
        ),
      },
    };
  }
}

export function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthUser(user: AuthUserRecord): AuthUser {
  return {
    email: user.email,
    emailVerified: user.emailVerified,
    id: user.id,
    role: user.role,
    ...(user.fullName ? { fullName: user.fullName } : {}),
  };
}

function isAuthClaims(payload: JwtPayload | string): payload is JwtPayload & {
  readonly email: string;
  readonly role: UserRole;
  readonly sub: string;
} {
  return (
    typeof payload !== "string" &&
    typeof payload.sub === "string" &&
    typeof payload.email === "string" &&
    (payload.role === "student" || payload.role === "admin")
  );
}
