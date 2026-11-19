import { createApi, UnknownTenantError, withStore } from "@onehope/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function profileFor(request: Request): "none" | "request" | "audit" {
  const path = new URL(request.url).pathname;
  if (request.method === "GET" && (path === "/api/health" || path === "/api/tenant")) return "none";
  if (request.method === "GET" && path === "/api/audit") return "audit";
  return "request";
}

function sessionToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const cookie = request.headers.get("cookie") ?? "";
  const match = /(?:^|; )onehope_session=([^;]+)/.exec(cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function handle(request: Request): Promise<Response> {
  try {
    return await withStore((store) => createApi({ store })(request), {
      host: request.headers.get("host"),
      token: sessionToken(request),
      profile: profileFor(request),
    });
  } catch (error) {
    if (error instanceof UnknownTenantError || (error instanceof Error && error.name === "UnknownTenantError")) {
      return Response.json({ ok: false, error: error.message, code: "not_found" }, { status: 404 });
    }
    throw error;
  }
}

export { handle as GET, handle as POST };
