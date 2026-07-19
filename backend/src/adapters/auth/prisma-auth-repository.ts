import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  EmailAlreadyExistsRepositoryError,
  type AuthUserRecord,
  type CreateAuthUserInput,
  type IAuthRepository,
  type RefreshTokenRecord,
  type RotateRefreshTokenInput,
  type SaveRefreshTokenInput,
} from "../../modules/auth/auth-repository.js";
import type { UserRole } from "../../ports/index.js";

export class PrismaAuthRepository implements IAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          ...(input.fullName ? { fullName: input.fullName } : {}),
        },
      });

      return mapUser(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new EmailAlreadyExistsRepositoryError();
      }

      throw error;
    }
  }

  async findRefreshToken(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      include: {
        user: true,
      },
      where: {
        tokenHash,
      },
    });

    if (!refreshToken) {
      return null;
    }

    return {
      expiresAt: refreshToken.expiresAt,
      revokedAt: refreshToken.revokedAt,
      tokenHash: refreshToken.tokenHash,
      user: mapUser(refreshToken.user),
    };
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    return user ? mapUser(user) : null;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? mapUser(user) : null;
  }

  async revokeRefreshToken(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      data: {
        revokedAt,
      },
      where: {
        revokedAt: null,
        tokenHash,
      },
    });
  }

  rotateRefreshToken(input: RotateRefreshTokenInput): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        data: {
          revokedAt: input.rotatedAt,
        },
        where: {
          expiresAt: {
            gt: input.rotatedAt,
          },
          revokedAt: null,
          tokenHash: input.currentTokenHash,
          userId: input.userId,
        },
      });

      if (revoked.count !== 1) {
        return false;
      }

      await transaction.refreshToken.create({
        data: {
          expiresAt: input.expiresAt,
          tokenHash: input.tokenHash,
          userId: input.userId,
        },
      });

      return true;
    });
  }

  async saveRefreshToken(input: SaveRefreshTokenInput): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        expiresAt: input.expiresAt,
        tokenHash: input.tokenHash,
        userId: input.userId,
      },
    });
  }

  async updateUserFullName(
    userId: string,
    fullName: string,
  ): Promise<AuthUserRecord | null> {
    const updated = await this.prisma.user.updateMany({
      data: { fullName },
      where: { id: userId },
    });
    if (updated.count !== 1) return null;
    return this.findUserById(userId);
  }
}

interface DatabaseUser {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly fullName: string | null;
  readonly id: string;
  readonly passwordHash: string;
  readonly role: string;
}

function mapUser(user: DatabaseUser): AuthUserRecord {
  return {
    email: user.email,
    emailVerified: user.emailVerified,
    fullName: user.fullName,
    id: user.id,
    passwordHash: user.passwordHash,
    role: parseUserRole(user.role),
  };
}

function parseUserRole(role: string): UserRole {
  if (role === "student" || role === "admin") {
    return role;
  }

  throw new Error(`Unsupported user role stored in database: ${role}`);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
