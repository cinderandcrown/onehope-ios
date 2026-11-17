"use server";

import { AccessError, getDemoStore } from "@onehope/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isLanguage } from "@/lib/i18n";

async function setSession(token: string) {
  const jar = await cookies();
  jar.set("onehope_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function previewSampleStaff() {
  const session = getDemoStore().loginSampleStaff({ ip: "command-center", userAgent: "sample-preview" });
  await setSession(session.token);
  redirect("/overview");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "");
  try {
    const store = getDemoStore();
    const session = store.login({ email, password, ip: "command-center", userAgent: "staff-form" });
    if (session.mfaRequired) {
      if (!/^\d{6}$/.test(code)) redirect("/login?error=mfa");
      store.verifyMfa(session.token, code);
      store.stepUp(session.token, { code });
    }
    await setSession(session.token);
  } catch (error) {
    if (error instanceof AccessError) redirect("/login?error=1");
    throw error;
  }
  redirect("/overview");
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (token) getDemoStore().logout(token);
  jar.delete("onehope_session");
  redirect("/login");
}

export async function setLanguage(formData: FormData) {
  const raw = String(formData.get("language") ?? "en");
  const jar = await cookies();
  jar.set("onehope_lang", isLanguage(raw) ? raw : "en", { sameSite: "lax", path: "/" });
}

export async function savePush(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const segment = formData.get("segment");
  if (segment !== "members" && segment !== "volunteers" && segment !== "parents") redirect("/push?error=1");
  if (!title || !body) redirect("/push?error=1");
  getDemoStore().sendPush(token, { title, body, segment });
  redirect("/push?saved=1");
}
