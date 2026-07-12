import { z } from "zod";

const cognitoAuthEnvironmentSchema = z.object({
  COGNITO_CLIENT_ID: z.string().trim().min(1),
  COGNITO_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(31_536_000)
    .default(2_592_000),
  COGNITO_REGION: z.string().trim().min(1).default("us-east-1"),
  COGNITO_USER_POOL_ID: z.string().trim().min(1),
});

export interface CognitoAuthConfig {
  readonly clientId: string;
  readonly refreshTokenTtlSeconds: number;
  readonly region: string;
  readonly userPoolId: string;
}

export function loadCognitoAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): CognitoAuthConfig {
  const parsed = cognitoAuthEnvironmentSchema.parse(environment);

  return {
    clientId: parsed.COGNITO_CLIENT_ID,
    refreshTokenTtlSeconds: parsed.COGNITO_REFRESH_TTL_SECONDS,
    region: parsed.COGNITO_REGION,
    userPoolId: parsed.COGNITO_USER_POOL_ID,
  };
}
