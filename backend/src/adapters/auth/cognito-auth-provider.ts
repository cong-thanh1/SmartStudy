import {
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RevokeTokenCommand,
  SignUpCommand,
  type InitiateAuthCommandInput,
  type InitiateAuthCommandOutput,
  type AdminGetUserCommandInput,
  type AdminGetUserCommandOutput,
  type AdminUpdateUserAttributesCommandInput,
  type RevokeTokenCommandInput,
  type SignUpCommandInput,
  type SignUpCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";

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
  EmailConfirmationRequiredError,
  InvalidCredentialsError,
  InvalidTokenError,
} from "../../modules/auth/auth-errors.js";
import type { CognitoAuthConfig } from "./cognito-auth-config.js";

interface CognitoIdTokenClaims {
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly exp: number;
  readonly "cognito:groups"?: readonly string[];
  readonly name?: string;
  readonly sub: string;
}

export type CognitoInitiateAuth = (
  input: InitiateAuthCommandInput,
) => Promise<InitiateAuthCommandOutput>;
export type CognitoSignUp = (
  input: SignUpCommandInput,
) => Promise<SignUpCommandOutput>;
export type CognitoRevokeToken = (
  input: RevokeTokenCommandInput,
) => Promise<void>;
export type CognitoAdminGetUser = (
  input: AdminGetUserCommandInput,
) => Promise<AdminGetUserCommandOutput>;
export type CognitoAdminUpdateUser = (
  input: AdminUpdateUserAttributesCommandInput,
) => Promise<void>;
export type VerifyCognitoIdToken = (
  token: string,
) => Promise<CognitoIdTokenClaims>;

export interface CognitoAuthProviderDependencies {
  readonly adminGetUser?: CognitoAdminGetUser;
  readonly adminUpdateUser?: CognitoAdminUpdateUser;
  readonly initiateAuth?: CognitoInitiateAuth;
  readonly now?: () => Date;
  readonly revokeToken?: CognitoRevokeToken;
  readonly signUp?: CognitoSignUp;
  readonly verifyIdToken?: VerifyCognitoIdToken;
}

export class CognitoAuthProvider implements IAuthProvider, IUserProfileProvider {
  private readonly adminGetUser: CognitoAdminGetUser;
  private readonly adminUpdateUser: CognitoAdminUpdateUser;
  private readonly initiateAuth: CognitoInitiateAuth;
  private readonly now: () => Date;
  private readonly revokeToken: CognitoRevokeToken;
  private readonly signUp: CognitoSignUp;
  private readonly verifyIdToken: VerifyCognitoIdToken;

  constructor(
    private readonly config: CognitoAuthConfig,
    dependencies: CognitoAuthProviderDependencies = {},
  ) {
    const client = new CognitoIdentityProviderClient({ region: config.region });
    this.adminGetUser =
      dependencies.adminGetUser ??
      ((input) => client.send(new AdminGetUserCommand(input)));
    this.adminUpdateUser =
      dependencies.adminUpdateUser ??
      (async (input) => {
        await client.send(new AdminUpdateUserAttributesCommand(input));
      });
    this.initiateAuth =
      dependencies.initiateAuth ??
      ((input) => client.send(new InitiateAuthCommand(input)));
    this.now = dependencies.now ?? (() => new Date());
    this.revokeToken =
      dependencies.revokeToken ??
      (async (input) => {
        await client.send(new RevokeTokenCommand(input));
      });
    this.signUp =
      dependencies.signUp ??
      ((input) => client.send(new SignUpCommand(input)));
    this.verifyIdToken = dependencies.verifyIdToken ?? createVerifier(config);
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    const email = normalizeEmail(input.email);

    try {
      const response = await this.signUp({
        ClientId: this.config.clientId,
        Password: input.password,
        UserAttributes: [
          { Name: "email", Value: email },
          ...(input.fullName
            ? [{ Name: "name", Value: input.fullName.trim() }]
            : []),
        ],
        Username: email,
      });

      if (!response.UserConfirmed) {
        throw new EmailConfirmationRequiredError();
      }
    } catch (error) {
      throw mapCognitoError(error);
    }

    return this.login({ email, password: input.password });
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const email = normalizeEmail(input.email);
    let response: InitiateAuthCommandOutput;

    try {
      response = await this.initiateAuth({
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: {
          PASSWORD: input.password,
          USERNAME: email,
        },
        ClientId: this.config.clientId,
      });
    } catch (error) {
      throw mapCognitoError(error);
    }

    return this.toSession(response.AuthenticationResult);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let response: InitiateAuthCommandOutput;

    try {
      response = await this.initiateAuth({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        AuthParameters: { REFRESH_TOKEN: refreshToken },
        ClientId: this.config.clientId,
      });
    } catch (error) {
      throw mapCognitoError(error);
    }

    const authenticationResult = response.AuthenticationResult;
    if (!authenticationResult?.IdToken) {
      throw new InvalidTokenError();
    }

    const claims = await this.verifyClaims(authenticationResult.IdToken);
    return {
      accessToken: authenticationResult.IdToken,
      accessTokenExpiresAt: new Date(claims.exp * 1_000),
      refreshToken: authenticationResult.RefreshToken ?? refreshToken,
      refreshTokenExpiresAt: addSeconds(
        this.now(),
        this.config.refreshTokenTtlSeconds,
      ),
    };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      await this.revokeToken({
        ClientId: this.config.clientId,
        Token: refreshToken,
      });
    } catch (error) {
      throw mapCognitoError(error);
    }
  }

  async verifyToken(accessToken: string): Promise<AuthClaims> {
    const claims = await this.verifyClaims(accessToken);

    return {
      email: claims.email ?? "",
      role: toRole(claims["cognito:groups"]),
      sub: claims.sub,
    };
  }

  async getProfile(claims: AuthClaims): Promise<AuthUser> {
    try {
      const response = await this.adminGetUser({
        UserPoolId: this.config.userPoolId,
        Username: claims.email,
      });
      return toProfileUser(response, claims);
    } catch (error) {
      throw mapCognitoError(error);
    }
  }

  async updateProfile(
    claims: AuthClaims,
    input: UpdateUserProfileInput,
  ): Promise<AuthUser> {
    try {
      await this.adminUpdateUser({
        UserAttributes: [{ Name: "name", Value: input.fullName.trim() }],
        UserPoolId: this.config.userPoolId,
        Username: claims.email,
      });
      return this.getProfile(claims);
    } catch (error) {
      throw mapCognitoError(error);
    }
  }

  private async toSession(
    authenticationResult: InitiateAuthCommandOutput["AuthenticationResult"],
  ): Promise<AuthSession> {
    if (!authenticationResult?.IdToken || !authenticationResult.RefreshToken) {
      throw new InvalidCredentialsError();
    }

    const claims = await this.verifyClaims(authenticationResult.IdToken);
    return {
      tokens: {
        accessToken: authenticationResult.IdToken,
        accessTokenExpiresAt: new Date(claims.exp * 1_000),
        refreshToken: authenticationResult.RefreshToken,
        refreshTokenExpiresAt: addSeconds(
          this.now(),
          this.config.refreshTokenTtlSeconds,
        ),
      },
      user: toAuthUser(claims),
    };
  }

  private async verifyClaims(token: string): Promise<CognitoIdTokenClaims> {
    try {
      const claims = await this.verifyIdToken(token);
      if (!claims.sub || !Number.isSafeInteger(claims.exp)) {
        throw new InvalidTokenError();
      }

      return claims;
    } catch {
      throw new InvalidTokenError();
    }
  }
}

function createVerifier(config: CognitoAuthConfig): VerifyCognitoIdToken {
  const verifier = CognitoJwtVerifier.create({
    clientId: config.clientId,
    tokenUse: "id",
    userPoolId: config.userPoolId,
  });

  return async (token) =>
    (await verifier.verify(token)) as unknown as CognitoIdTokenClaims;
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

function mapCognitoError(error: unknown): Error {
  if (error instanceof EmailConfirmationRequiredError) {
    return error;
  }

  const name =
    typeof error === "object" && error !== null && "name" in error
      ? error.name
      : undefined;

  if (name === "UsernameExistsException") {
    return new EmailAlreadyRegisteredError();
  }

  if (
    name === "NotAuthorizedException" ||
    name === "UserNotConfirmedException" ||
    name === "InvalidParameterException"
  ) {
    return new InvalidCredentialsError();
  }

  return error instanceof Error ? error : new Error("Cognito request failed");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthUser(claims: CognitoIdTokenClaims): AuthUser {
  return {
    email: claims.email ?? "",
    emailVerified: claims.email_verified ?? false,
    ...(claims.name ? { fullName: claims.name } : {}),
    id: claims.sub,
    role: toRole(claims["cognito:groups"]),
  };
}

function toProfileUser(
  response: AdminGetUserCommandOutput,
  claims: AuthClaims,
): AuthUser {
  const attributes = new Map(
    (response.UserAttributes ?? []).flatMap((attribute) =>
      attribute.Name && attribute.Value
        ? [[attribute.Name, attribute.Value] as const]
        : [],
    ),
  );
  const email = attributes.get("email") ?? claims.email;
  const fullName = attributes.get("name")?.trim();
  return {
    email,
    emailVerified: attributes.get("email_verified") === "true",
    ...(fullName ? { fullName } : {}),
    id: attributes.get("sub") ?? claims.sub,
    role: claims.role,
  };
}

function toRole(groups: readonly string[] | undefined): UserRole {
  return groups?.includes("admin") ? "admin" : "student";
}
