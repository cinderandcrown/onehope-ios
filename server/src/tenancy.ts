export const TENANT_IDS = ["onehope", "revivalcoffee", "cinderandcrown"] as const;

export type KnownTenantId = (typeof TENANT_IDS)[number];

export type TenantProfile = {
  id: string;
  name: string;
  timezone: string;
  pickupOnly: boolean;
};

export const BUILTIN_DOMAINS: readonly { host: string; tenantId: string }[] = [
  { host: "onehope-beryl.vercel.app", tenantId: "onehope" },
  { host: "weareonehope.com", tenantId: "onehope" },
  { host: "www.weareonehope.com", tenantId: "onehope" },
  { host: "localhost", tenantId: "onehope" },
  { host: "127.0.0.1", tenantId: "onehope" },
  { host: "order.myrevivalcoffee.com", tenantId: "revivalcoffee" },
];

const PROFILES: Record<KnownTenantId, TenantProfile> = {
  onehope: { id: "onehope", name: "One Hope", timezone: "America/Chicago", pickupOnly: false },
  revivalcoffee: {
    id: "revivalcoffee",
    name: "Revival Coffee",
    timezone: "America/Chicago",
    pickupOnly: true,
  },
  cinderandcrown: {
    id: "cinderandcrown",
    name: "Cinder & Crown",
    timezone: "America/Chicago",
    pickupOnly: false,
  },
};

export function tenantProfile(id: string): TenantProfile {
  switch (id) {
    case "onehope":
    case "revivalcoffee":
    case "cinderandcrown":
      return PROFILES[id];
    default:
      return { id, name: id, timezone: "America/Chicago", pickupOnly: false };
  }
}

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0].trim().toLowerCase();
}

/**
 * Tenant comes from TENANT_MODE=single or from the Host header.
 * There is no parameter for a client-supplied tenant id. Do not add one.
 */
export function resolveTenant(input: {
  host: string | null;
  mode?: string | null;
  singleTenantId?: string | null;
  domains?: readonly { host: string; tenantId: string }[];
}): string {
  if ((input.mode ?? "pooled") === "single") {
    const id = input.singleTenantId?.trim();
    if (!id) throw new Error("TENANT_ID is required when TENANT_MODE=single.");
    return id;
  }
  const host = normalizeHost(input.host);
  const domains = input.domains ?? BUILTIN_DOMAINS;
  return domains.find((row) => row.host === host)?.tenantId ?? "onehope";
}
