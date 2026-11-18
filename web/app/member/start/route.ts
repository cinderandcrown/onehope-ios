import { NextResponse } from "next/server";

import { SAMPLE_MEMBER_EMAIL, SAMPLE_PASSWORD, withStore } from "@onehope/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = await withStore(
    (store) =>
      store.login({
        email: SAMPLE_MEMBER_EMAIL,
        password: SAMPLE_PASSWORD,
        ip: "member-web",
        userAgent: "pwa",
      }).token,
  );
  const response = NextResponse.redirect(new URL("/member", request.url));
  response.cookies.set("onehope_member", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
