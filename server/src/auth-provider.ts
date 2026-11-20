import { hashPassword, verifyPassword } from "./crypto";

/**
 * Who checks a person's credentials.
 * - "local": this app's passwords and TOTP. One Hope uses it today.
 * - "clerk": Clerk Organizations (decision D1). Clerk owns passwords and MFA, so the password
 *   methods refuse. Sessions are resolved in clerk-auth.ts, and the tenant comes from the
 *   verified org claim, never from the client.
 * ChurchStore calls the local provider for password checks.
 */
export type AuthProviderId = "local" | "clerk";

export type AuthProvider = {
  readonly id: AuthProviderId;
  hashPassword(password: string): string;
  verifyPassword(password: string, stored: string): boolean;
};

export const localAuthProvider: AuthProvider = {
  id: "local",
  hashPassword,
  verifyPassword,
};

export class PasswordsHandledElsewhereError extends Error {
  constructor(provider: AuthProviderId) {
    super(`Passwords are handled by ${provider}. This server does not store or check them.`);
    this.name = "PasswordsHandledElsewhereError";
  }
}

export const clerkAuthProvider: AuthProvider = {
  id: "clerk",
  hashPassword() {
    throw new PasswordsHandledElsewhereError("clerk");
  },
  verifyPassword() {
    throw new PasswordsHandledElsewhereError("clerk");
  },
};

/** AUTH_PROVIDER=clerk selects Clerk. Anything else keeps local auth. */
export function authProviderFor(env: NodeJS.ProcessEnv = process.env): AuthProvider {
  return env.AUTH_PROVIDER?.trim().toLowerCase() === "clerk" ? clerkAuthProvider : localAuthProvider;
}
