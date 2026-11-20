import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import pg from "pg";

import type { SqlClient } from "./migrate";

if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;

/** The part of a pg-compatible client this package uses. */
export type DbClient = {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  release(): void;
};

export type DbPool = {
  connect(): Promise<DbClient>;
  end(): Promise<void>;
};

export type DbDriver = "neon" | "pg";

/**
 * Neon hosts use the Neon serverless driver (WebSocket).
 * Every other host, Supabase included, uses node-postgres over TCP.
 * DATABASE_DRIVER=neon or DATABASE_DRIVER=pg overrides the guess.
 */
export function driverFor(url: string, env: NodeJS.ProcessEnv = process.env): DbDriver {
  const forced = env.DATABASE_DRIVER?.trim().toLowerCase();
  if (forced === "neon" || forced === "pg") return forced;
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "pg";
  }
  return host.endsWith(".neon.tech") ? "neon" : "pg";
}

/**
 * TLS for node-postgres. Supabase signs its server certificate with its own root CA.
 * Put that PEM in DATABASE_CA_CERT to verify it. Without it, the connection string's sslmode applies.
 */
function sslOptions(env: NodeJS.ProcessEnv): pg.PoolConfig["ssl"] {
  const ca = env.DATABASE_CA_CERT?.trim();
  if (!ca) return undefined;
  return { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true };
}

export function createPool(url: string, max: number, env: NodeJS.ProcessEnv = process.env): DbPool {
  if (driverFor(url, env) === "neon")
    return new NeonPool({ connectionString: url, max }) as unknown as DbPool;
  const ssl = sslOptions(env);
  const connectionString = ssl ? stripSslParams(url) : url;
  return new pg.Pool({ connectionString, max, ...(ssl ? { ssl } : {}) }) as unknown as DbPool;
}

/** node-postgres lets sslmode in the URL override the ssl object, so drop it when a CA is supplied. */
function stripSslParams(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) parsed.searchParams.delete(key);
    return parsed.toString();
  } catch {
    return url;
  }
}

export function clientSql(client: DbClient): SqlClient {
  return {
    async exec(sqlText) {
      await client.query(sqlText);
    },
    async query<T extends Record<string, unknown>>(text: string, params?: readonly unknown[]) {
      const result = await client.query(text, params ? [...params] : []);
      return { rows: result.rows as T[] };
    },
  };
}
