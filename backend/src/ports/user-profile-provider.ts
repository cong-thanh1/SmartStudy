import type { AuthClaims, AuthUser } from "./auth-provider.js";

export interface UpdateUserProfileInput {
  readonly fullName: string;
}

export interface IUserProfileProvider {
  getProfile(claims: AuthClaims): Promise<AuthUser>;
  updateProfile(claims: AuthClaims, input: UpdateUserProfileInput): Promise<AuthUser>;
}
