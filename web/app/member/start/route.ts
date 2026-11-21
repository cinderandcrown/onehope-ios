import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const jar = await cookies();
  jar.delete("onehope_member");
  const next = new URL("/member", request.url);
  if (new URL(request.url).searchParams.get("deleted") === "1") next.searchParams.set("deleted", "1");
  return NextResponse.redirect(next);
}
