export type SyncStatus = "succeeded" | "failed";

export type SyncRecord = { status: SyncStatus; attempts: number };

export type SyncStore = {
  get: (key: string) => SyncRecord | undefined;
  save: (key: string, status: SyncStatus, attempts: number) => void;
};

export function memorySyncStore(): SyncStore {
  const rows = new Map<string, SyncRecord>();
  return {
    get(key) {
      const row = rows.get(key);
      return row ? { ...row } : undefined;
    },
    save(key, status, attempts) {
      rows.set(key, { status, attempts });
    },
  };
}

export async function runSync(options: {
  key: string;
  name: string;
  store: SyncStore;
  run: () => Promise<void>;
  retries?: number;
  sleep?: (attempt: number) => Promise<void>;
}): Promise<{ status: "succeeded"; attempts: number; skipped: boolean; name: string }> {
  const retries = options.retries ?? 3;
  const existing = options.store.get(options.key);
  if (existing?.status === "succeeded") {
    return { status: "succeeded", attempts: existing.attempts, skipped: true, name: options.name };
  }
  let attempts = 0;
  let lastError: unknown;
  while (attempts < retries) {
    attempts += 1;
    try {
      await options.run();
      options.store.save(options.key, "succeeded", attempts);
      return { status: "succeeded", attempts, skipped: false, name: options.name };
    } catch (error) {
      lastError = error;
      options.store.save(options.key, "failed", attempts);
      if (attempts < retries && options.sleep) await options.sleep(attempts);
    }
  }
  const message = lastError instanceof Error ? lastError.message : "Sync failed.";
  throw new Error(`${options.name} failed after ${attempts} attempts: ${message}`);
}
