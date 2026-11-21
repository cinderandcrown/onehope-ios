"use server";

import { isStaff, publicBaseUrl, withStore } from "@onehope/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: publicBaseUrl().startsWith("https://"),
  };
}

export async function claimAccountAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const inviteToken = String(formData.get("inviteToken") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) redirect("/claim?error=short");
  if (password !== confirm) redirect("/claim?error=match");
  let next: { token: string; staff: boolean; enroll: boolean };
  try {
    next = await withStore((store) => {
      const session = store.claimInvite({
        email,
        inviteToken,
        password,
        ip: "claim-page",
        userAgent: "claim-page",
      });
      const staff = isStaff(session.person.role);
      return {
        token: session.token,
        staff,
        enroll: staff && store.totpStatus(session.token) === "enroll",
      };
    });
  } catch {
    redirect("/claim?error=1");
  }
  const jar = await cookies();
  if (next.staff) {
    jar.set("onehope_session", next.token, cookieOptions());
    redirect(next.enroll ? "/enroll" : "/overview");
  }
  jar.set("onehope_member", next.token, { ...cookieOptions(), maxAge: 60 * 60 * 12 });
  redirect("/member");
}
