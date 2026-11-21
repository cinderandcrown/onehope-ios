"use server";

import { publicBaseUrl, withStore } from "@onehope/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function setMember(token: string) {
  const jar = await cookies();
  jar.set("onehope_member", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: publicBaseUrl().startsWith("https://"),
    maxAge: 60 * 60 * 12,
  });
}

function accessMessage(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error) || !("message" in error)) return null;
  return String(error.message);
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
    if (accessMessage(error)) redirect("/member?error=password");
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
    const message = accessMessage(error);
    if (message) redirect("/member?error=signup");
    throw error;
  }
  redirect("/member");
}

export async function deleteMember(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("onehope_member")?.value;
  const password = String(formData.get("password") ?? "");
  if (!token) redirect("/member");
  try {
    await withStore((store) => {
      store.stepUp(token, { password });
      store.deleteSelf(token);
    }, { token });
  } catch (error) {
    if (accessMessage(error)) redirect("/member?error=password");
    throw error;
  }
  jar.delete("onehope_member");
  redirect("/member?deleted=1");
}

export async function signOutMember() {
  const jar = await cookies();
  const token = jar.get("onehope_member")?.value;
  if (token) await withStore((store) => store.logout(token), { token });
  jar.delete("onehope_member");
  redirect("/member");
}
