import { headers } from "next/headers";
import { withStore, type ChurchStore, type StoreScope } from "@onehope/server";

/** The browser host, so Postgres can pick the church. Memory mode ignores it. */
export async function requestHost(): Promise<string | null> {
  const incoming = await headers();
  return incoming.get("x-forwarded-host") ?? incoming.get("host");
}

export async function withChurch<T>(
  fn: (store: ChurchStore) => Promise<T> | T,
  scope: Omit<StoreScope, "host"> = {},
): Promise<T> {
  return withStore(fn, { ...scope, host: await requestHost() });
}
