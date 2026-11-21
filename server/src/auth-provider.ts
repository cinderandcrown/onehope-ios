import { hashPassword, verifyPassword } from "./crypto";

/**
 * The live provider is this app's passwords and TOTP.
 * Clerk Organizations (decision D1) would be another implementation of this interface.
 * ChurchStore calls this provider for password checks.
 */
export type AuthProvider = {
  readonly id: "local";
  hashPassword(password: string): string;
  verifyPassword(password: string, stored: string): boolean;
};

export const localAuthProvider: AuthProvider = {
  id: "local",
  hashPassword,
  verifyPassword,
};
