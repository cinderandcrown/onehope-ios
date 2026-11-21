import { createApi, storeErrorResponse, tablesFor, withStore } from "@onehope/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function profileFor(request: Request): "none" | "request" | "audit" {
  const path = new URL(request.url).pathname;
  const tables = tablesFor(request.method, path);
  if (tables && tables.length === 0) return "none";
  if (request.method === "GET" && path === "/api/audit") return "audit";
  return "request";
}

function tablesForRequest(request: Request): readonly string[] | undefined {
  const tables = tablesFor(request.method, new URL(request.url).pathname);
  if (!tables || tables.length === 0) return undefined;
  return tables;
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
      tables: tablesForRequest(request),
    });
  } catch (error) {
    const mapped = storeErrorResponse(error);
    if (mapped) return Response.json(mapped.body, { status: mapped.status });
    throw error;
  }
}

export { handle as GET, handle as POST };
