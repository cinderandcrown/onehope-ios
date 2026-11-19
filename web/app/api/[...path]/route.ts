import { createApi, withStore } from "@onehope/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  return withStore((store) => createApi({ store })(request), { host: request.headers.get("host") });
}

export { handle as GET, handle as POST };
