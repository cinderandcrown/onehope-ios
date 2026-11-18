"use server";

import { AccessError, withStore } from "@onehope/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function setMember(token: string) {
  const jar = await cookies();
  jar.set("onehope_member", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
}

export async function signInMember(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    const token = await withStore(
      (store) => store.login({ email, password, ip: "member-web", userAgent: "member-web" }).token,
    );
    await setMember(token);
  } catch (error) {
    if (error instanceof AccessError) redirect("/member?error=1");
    throw error;
  }
  redirect("/member");
}

export async function signUpMember(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("name") ?? "");
  try {
    const token = await withStore(
      (store) =>
        store.signup({ email, password, displayName, ip: "member-web", userAgent: "member-web" }).token,
    );
    await setMember(token);
  } catch (error) {
    if (error instanceof AccessError) redirect("/member?error=1");
    throw error;
  }
  redirect("/member");
}

export async function signOutMember() {
  const jar = await cookies();
  const token = jar.get("onehope_member")?.value;
  if (token) await withStore((store) => store.logout(token));
  jar.delete("onehope_member");
  redirect("/member");
}
