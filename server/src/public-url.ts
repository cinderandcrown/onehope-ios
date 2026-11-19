/**
 * One public address for share links, invite pages, and (later) the church
 * subdomain. The default stays the current Vercel host until DNS moves.
 * Nothing here changes DNS or the Vercel project.
 */

export const DEFAULT_PUBLIC_BASE_URL = "https://onehope-beryl.vercel.app";

/** Hosts that may call the API from a browser. The marketing site only links in. */
export const CHURCH_WEB_ORIGINS = [
  "https://www.weareonehope.com",
  "https://weareonehope.com",
  "https://app.weareonehope.com",
] as const;

const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function publicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.PUBLIC_BASE_URL ?? "").trim() || DEFAULT_PUBLIC_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PUBLIC_BASE_URL must be an absolute http(s) URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("PUBLIC_BASE_URL must be http or https.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("PUBLIC_BASE_URL must not include a user, query, or hash.");
  }
  return url.origin + (url.pathname === "/" ? "" : url.pathname.replace(/\/$/, ""));
}

export function publicOrigin(base = publicBaseUrl()): string {
  return new URL(base).origin;
}

/** Paths the phone may open with a universal link. */
export const UNIVERSAL_LINK_PATHS = [
  "/invite",
  "/invite/*",
  "/visit",
  "/coffee",
  "/neighborhood",
  "/member",
  "/member/*",
];

export function originAllowed(origin: string, base = publicBaseUrl()): boolean {
  if (CHURCH_WEB_ORIGINS.includes(origin as (typeof CHURCH_WEB_ORIGINS)[number])) return true;
  if (LOCAL_ORIGINS.includes(origin)) return true;
  try {
    return new URL(origin).origin === publicOrigin(base);
  } catch {
    return false;
  }
}

export function inviteUrl(base = publicBaseUrl(), note = ""): string {
  const url = new URL("/invite", base.endsWith("/") ? base : `${base}/`);
  const clean = note.trim().slice(0, 280);
  if (clean) url.searchParams.set("note", clean);
  return url.toString();
}
