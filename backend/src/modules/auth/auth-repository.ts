import type { UserRole } from "../../ports/index.js";

export interface AuthUserRecord {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly fullName: string | null;
  readonly id: string;
  readonly passwordHash: string;
  readonly role: UserRole;
}

export interface RefreshTokenRecord {
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly tokenHash: string;
  readonly user: AuthUserRecord;
}

export interface CreateAuthUserInput {
  readonly email: string;
  readonly fullName?: string;
  readonly passwordHash: string;
}

export interface SaveRefreshTokenInput {
  readonly expiresAt: Date;
  readonly tokenHash: string;
  readonly userId: string;
}

export interface RotateRefreshTokenInput extends SaveRefreshTokenInput {
  readonly currentTokenHash: string;
  readonly rotatedAt: Date;
}

export class EmailAlreadyExistsRepositoryError extends Error {
  constructor() {
    super("User email already exists");
    this.name = "EmailAlreadyExistsRepositoryError";
  }
}

export interface IAuthRepository {
  createUser(input: CreateAuthUserInput): Promise<AuthUserRecord>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findUserById(userId: string): Promise<AuthUserRecord | null>;
  revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void>;
  rotateRefreshToken(input: RotateRefreshTokenInput): Promise<boolean>;
  saveRefreshToken(input: SaveRefreshTokenInput): Promise<void>;
  updateUserFullName(userId: string, fullName: string): Promise<AuthUserRecord | null>;
}
