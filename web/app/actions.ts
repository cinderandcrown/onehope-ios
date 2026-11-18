"use server";

import { AccessError, withStore } from "@onehope/server";
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
  await setSession("session-staff-demo");
  redirect("/overview");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "");
  try {
    const token = await withStore((store) => {
      const session = store.login({ email, password, ip: "command-center", userAgent: "staff-form" });
      if (session.mfaRequired) {
        if (!/^\d{6}$/.test(code)) throw new AccessError("mfa_required", "Enter the 6-digit code.");
        store.verifyMfa(session.token, code);
        store.stepUp(session.token, { code });
      }
      return session.token;
    });
    await setSession(token);
  } catch (error) {
    if (error instanceof AccessError) redirect("/login?error=1");
    throw error;
  }
  redirect("/overview");
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (token) await withStore((store) => store.logout(token));
  jar.delete("onehope_session");
  redirect("/login");
}

export async function setLanguage(formData: FormData) {
  const raw = String(formData.get("language") ?? "en");
  const jar = await cookies();
  jar.set("onehope_lang", isLanguage(raw) ? raw : "en", { sameSite: "lax", path: "/" });
}

export async function createGroupAction(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (!name || !summary) redirect("/groups?error=1");
  await withStore((store) => store.createGroup(token, { name, summary }));
  redirect("/groups");
}

export async function createEventAction(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  if (!title || !location) redirect("/events?error=1");
  const start = Date.now() + 7 * 24 * 60 * 60 * 1000;
  await withStore((store) => store.createEvent(token, { title, location, start, end: start + 90 * 60 * 1000 }));
  redirect("/events");
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
  await withStore((store) => store.sendPush(token, { title, body, segment }));
  redirect("/push?saved=1");
}
