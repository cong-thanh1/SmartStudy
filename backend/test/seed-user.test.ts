import { describe, expect, it } from "vitest";

import { getSeedUserInput } from "../src/database/seed-user.js";

describe("seed user input", () => {
  it("normalizes a valid sample user", () => {
    expect(
      getSeedUserInput({
        SEED_USER_EMAIL: "  Student@Example.COM ",
        SEED_USER_FULL_NAME: " Sample Student ",
        SEED_USER_PASSWORD: "a-secure-local-password",
      }),
    ).toEqual({
      email: "student@example.com",
      fullName: "Sample Student",
      password: "a-secure-local-password",
    });
  });

  it("uses the default full name when none is provided", () => {
    expect(
      getSeedUserInput({
        SEED_USER_EMAIL: "student@example.com",
        SEED_USER_PASSWORD: "a-secure-local-password",
      }).fullName,
    ).toBe("SmartStudy Student");
  });

  it("requires an email", () => {
    expect(() =>
      getSeedUserInput({
        SEED_USER_PASSWORD: "a-secure-local-password",
      }),
    ).toThrow("SEED_USER_EMAIL is required");
  });

  it.each([undefined, "", "too-short"])(
    "rejects a missing or short password: %s",
    (password) => {
      expect(() =>
        getSeedUserInput({
          SEED_USER_EMAIL: "student@example.com",
          SEED_USER_PASSWORD: password,
        }),
      ).toThrow("SEED_USER_PASSWORD must contain at least 12 characters");
    },
  );
});
