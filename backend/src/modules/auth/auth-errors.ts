export type AuthErrorCode =
  | "EMAIL_CONFIRMATION_REQUIRED"
  | "EMAIL_ALREADY_REGISTERED"
  | "INVALID_CREDENTIALS"
  | "INVALID_TOKEN"
  | "WEAK_PASSWORD";

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class EmailAlreadyRegisteredError extends AuthError {
  constructor() {
    super(
      "EMAIL_ALREADY_REGISTERED",
      409,
      "An account with this email already exists",
    );
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class EmailConfirmationRequiredError extends AuthError {
  constructor() {
    super(
      "EMAIL_CONFIRMATION_REQUIRED",
      409,
      "Email confirmation is required before signing in",
    );
    this.name = "EmailConfirmationRequiredError";
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super("INVALID_CREDENTIALS", 401, "Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class InvalidTokenError extends AuthError {
  constructor() {
    super("INVALID_TOKEN", 401, "Invalid or expired token");
    this.name = "InvalidTokenError";
  }
}

export class WeakPasswordError extends AuthError {
  constructor() {
    super(
      "WEAK_PASSWORD",
      400,
      "Password must contain at least 12 characters",
    );
    this.name = "WeakPasswordError";
  }
}
