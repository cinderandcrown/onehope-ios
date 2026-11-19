import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type AdapterMode = "live" | "dry_run" | "not_built";

/**
 * A capability may be live only when `implemented` is true and, if it needs a
 * secret, that secret is in tenant_integrations. Notes describe what the code
 * actually does.
 */
export type AdapterDefinition = {
  id: string;
  provider: string;
  product: string;
  implemented: boolean;
  /** File that contains the real call, when implemented is true. */
  backing: string | null;
  reads: boolean;
  writes: boolean;
  requiresCredential: boolean;
  /** Provider key stored in tenant_integrations. Empty when no secret is required. */
  credentialProvider: string | null;
  notes: string;
};

export const ADAPTERS: readonly AdapterDefinition[] = [
  {
    id: "planning-center",
    provider: "Planning Center",
    product: "People, groups, calendar, services, giving",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: true,
    credentialProvider: "planning_center",
    notes:
      "No Planning Center HTTP client exists. OAuth and the importer are not built. Nothing is read from or written to Planning Center.",
  },
  {
    id: "stripe",
    provider: "Stripe",
    product: "PaymentIntents",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: true,
    credentialProvider: "stripe",
    notes:
      "A PaymentIntent request can be posted and its response is discarded. There is no PaymentSheet, webhook, or charge confirmation. This does not take a gift.",
  },
  {
    id: "youtube",
    provider: "YouTube",
    product: "Public RSS",
    implemented: true,
    backing: "server/src/adapters.ts",
    reads: true,
    writes: false,
    requiresCredential: false,
    credentialProvider: null,
    notes: "Channel @Weareonehope via the public Atom feed. No API key. Sermons are not stored.",
  },
  {
    id: "facebook",
    provider: "Facebook",
    product: "Graph live video",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: true,
    credentialProvider: "facebook",
    notes: "No Graph call exists. A Page token, if stored, is not used. The Watch tab has no live video.",
  },
  {
    id: "instagram",
    provider: "Instagram",
    product: "Graph media",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: true,
    credentialProvider: "instagram",
    notes: "No Instagram HTTP client exists. The app links to the public profile.",
  },
  {
    id: "resend",
    provider: "Resend",
    product: "Email",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: true,
    credentialProvider: "resend",
    notes: "No Resend client exists. Outbox jobs can record an email send. Nothing is delivered.",
  },
  {
    id: "twilio",
    provider: "Twilio",
    product: "SMS",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: true,
    credentialProvider: "twilio",
    notes: "No Twilio client exists. Text-to-give and SMS are not sent. The 84321 number belongs to Church Center.",
  },
  {
    id: "apns",
    provider: "Apple",
    product: "APNs push",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: true,
    credentialProvider: "apns",
    notes: "No device-token table is written and no APNs request is made. The composer does not deliver.",
  },
  {
    id: "calendar",
    provider: "Calendar",
    product: "ICS",
    implemented: true,
    backing: "server/src/domain.ts",
    reads: true,
    writes: false,
    requiresCredential: false,
    credentialProvider: null,
    notes: "Events export as ICS. The phone can add them with EventKit. No Google Calendar account is used.",
  },
  {
    id: "maps",
    provider: "Maps",
    product: "MapKit",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: false,
    credentialProvider: null,
    notes: "Directions are an Apple Maps link. There is no MapKit view.",
  },
  {
    id: "api-bible",
    provider: "API.Bible",
    product: "Passages",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: true,
    credentialProvider: "api_bible",
    notes: "No API.Bible request exists. Daily readings are the built-in public-domain KJV list.",
  },
  {
    id: "quickbooks",
    provider: "QuickBooks Online",
    product: "Export",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: true,
    credentialProvider: "quickbooks",
    notes: "The download is a small CSV, not an IIF or QBO import file. No OAuth posting.",
  },
  {
    id: "square",
    provider: "Square",
    product: "Orders and payments",
    implemented: true,
    backing: "server/src/square.ts",
    reads: true,
    writes: true,
    requiresCredential: true,
    credentialProvider: "square",
    notes:
      "square.ts can list variations and create an order and a payment. The adapter stays dry-run until the revivalcoffee tenant has a connected credential. Environment variables do not count as connected. The legacy order route still reads SQUARE_ACCESS_TOKEN when that route is called.",
  },
  {
    id: "labels",
    provider: "Label printers",
    product: "Zebra and Brother",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: false,
    credentialProvider: null,
    notes: "zebraLabel() returns ZPL text. No socket is opened and no printer path is configured.",
  },
  {
    id: "posthog",
    provider: "PostHog",
    product: "Product analytics",
    implemented: false,
    backing: null,
    reads: false,
    writes: false,
    requiresCredential: true,
    credentialProvider: "posthog",
    notes: "No capture call exists. The finance funnel on screen is a fixed sample.",
  },
];

export function adapterMode(adapter: AdapterDefinition, credentialPresent: boolean): AdapterMode {
  if (!adapter.implemented || !adapter.backing) return "not_built";
  if (adapter.requiresCredential && !credentialPresent) return "dry_run";
  return "live";
}

export type CapabilityView = {
  provider: string;
  product: string;
  read: boolean;
  write: boolean;
  status: AdapterMode;
  notes: string;
};

export function projectCapabilities(connectedProviders: ReadonlySet<string>): CapabilityView[] {
  return ADAPTERS.map((adapter) => {
    const connected =
      adapter.credentialProvider !== null && connectedProviders.has(adapter.credentialProvider);
    const status = adapterMode(adapter, connected);
    return {
      provider: adapter.provider,
      product: adapter.product,
      read: status === "live" ? adapter.reads : false,
      write: status === "live" ? adapter.writes : false,
      status,
      notes: adapter.notes,
    };
  });
}

/** Directory that contains server/src, walking up from cwd and this file. */
export function sourceRoot(): string {
  const starts = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const start of starts) {
    let dir = start;
    for (let hop = 0; hop < 8; hop += 1) {
      if (existsSync(resolve(dir, "server/src/adapters.ts"))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

/** Fails when a live row has no backing module or no required credential. */
export function assertTruthful(
  connectedProviders: ReadonlySet<string> = new Set(),
  root?: string,
): void {
  for (const adapter of ADAPTERS) {
    if (root && adapter.backing) {
      const file = resolve(root, adapter.backing);
      if (!existsSync(file)) throw new Error(`${adapter.id} backing file is missing.`);
    }
    const connected =
      adapter.credentialProvider !== null && connectedProviders.has(adapter.credentialProvider);
    const status = adapterMode(adapter, connected);
    if (status === "live" && (!adapter.implemented || !adapter.backing)) {
      throw new Error(`${adapter.id} is live without backing code.`);
    }
    if (status === "live" && adapter.requiresCredential && !connected) {
      throw new Error(`${adapter.id} is live without a tenant credential.`);
    }
    if (!adapter.implemented && adapter.backing) {
      throw new Error(`${adapter.id} names backing code but is not implemented.`);
    }
  }
}
