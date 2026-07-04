export interface SeedUserInput {
  readonly email: string;
  readonly fullName: string;
  readonly password: string;
}

export function getSeedUserInput(
  environment: NodeJS.ProcessEnv,
): SeedUserInput {
  const email = environment.SEED_USER_EMAIL?.trim().toLowerCase();
  const password = environment.SEED_USER_PASSWORD;
  const fullName =
    environment.SEED_USER_FULL_NAME?.trim() || "SmartStudy Student";

  if (!email) {
    throw new Error("SEED_USER_EMAIL is required to seed the database");
  }

  if (!password || password.length < 12) {
    throw new Error("SEED_USER_PASSWORD must contain at least 12 characters");
  }

  return {
    email,
    fullName,
    password,
  };
}
