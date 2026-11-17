export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SECRET_KEYS = new Set([
  "password",
  "totp",
  "code",
  "secret",
  "authorization",
  "cardnumber",
  "pan",
  "cvc",
  "cvv",
  "token",
]);

export function redact(value: unknown): unknown {
  if (typeof value === "string") return value.replace(EMAIL, "[redacted-email]");
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (typeof value === "object" && value) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = SECRET_KEYS.has(key.toLowerCase()) ? "[redacted]" : redact(inner);
    }
    return out;
  }
  return null;
}

export type Logger = {
  log: (level: LogLevel, event: string, fields?: LogFields) => void;
};

export function createLogger(sink: (line: string) => void = (line) => console.log(line)): Logger {
  return {
    log(level, event, fields = {}) {
      const safe = redact(fields);
      const extra = safe && typeof safe === "object" && !Array.isArray(safe) ? safe : {};
      sink(JSON.stringify({ time: new Date().toISOString(), level, event, ...extra }));
    },
  };
}

export type ErrorReporter = {
  capture: (error: unknown, context: Record<string, string>) => void;
};

export const noopReporter: ErrorReporter = {
  capture() {
    return undefined;
  },
};
