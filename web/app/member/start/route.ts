import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const jar = await cookies();
  jar.delete("onehope_member");
  return NextResponse.redirect(new URL("/member", request.url));
}
