import { createHash } from "node:crypto";

import { loadSermons } from "./adapters";
import type { YoutubeVideo } from "./domain";

/** Public, read-only routes that every phone loads. The CDN may hold them for a short time. */
const PUBLIC_GETS = new Set([
  "/api/home",
  "/api/sermons",
  "/api/coffee",
  "/api/growth",
  "/api/know-jesus",
  "/api/social",
  "/api/tenant",
]);

export function isCacheablePublicGet(method: string, path: string, hasSession: boolean): boolean {
  return method === "GET" && !hasSession && PUBLIC_GETS.has(path);
}

/**
 * Adds a short shared-cache window and an ETag, and answers 304 when the phone
 * already has the same body. At 40k people this keeps the home screen off the
 * database for most opens. Host is part of the CDN cache key, so tenants never mix.
 */
export function withPublicCache(request: Request, payload: Record<string, unknown>): Response {
  const body = JSON.stringify({ ok: true, ...payload });
  const etag = `W/"${createHash("sha1").update(body).digest("base64url").slice(0, 27)}"`;
  const headers = {
    "cache-control": "public, max-age=15, s-maxage=30, stale-while-revalidate=300",
    etag,
    vary: "Accept-Encoding",
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { status: 200, headers: { ...headers, "content-type": "application/json" } });
}

export function pageOf(query: URLSearchParams, defaults: { limit: number; max: number }) {
  const limit = Number.parseInt(query.get("limit") ?? "", 10);
  const offset = Number.parseInt(query.get("offset") ?? "", 10);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, defaults.max) : defaults.limit,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
  };
}

const SERMON_TTL_MS = 5 * 60 * 1000;
const sermonCache = new Map<string, { at: number; videos: YoutubeVideo[] }>();

/** One YouTube feed read per instance every five minutes, not one per phone. */
export async function cachedSermons(
  fetchImpl: typeof fetch,
  channelId: string,
  now: number = Date.now(),
): Promise<YoutubeVideo[]> {
  const hit = sermonCache.get(channelId);
  if (hit && now - hit.at < SERMON_TTL_MS) return hit.videos;
  const videos = await loadSermons(fetchImpl, channelId);
  if (videos.length > 0) sermonCache.set(channelId, { at: now, videos });
  else if (hit) return hit.videos;
  return videos;
}

export function clearSermonCache(): void {
  sermonCache.clear();
}
