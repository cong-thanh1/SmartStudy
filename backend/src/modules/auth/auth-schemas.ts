import { z } from "zod";

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(12).max(128);

export const registerSchema = z
  .object({
    email: emailSchema,
    fullName: z.string().trim().min(1).max(255).optional(),
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1).max(512),
  })
  .strict();

export const updateProfileSchema = z
  .object({ fullName: z.string().trim().min(1).max(80) })
  .strict();
