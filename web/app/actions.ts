"use server";

import {
  AccessError,
  FOLLOW_UP_STATUSES,
  parseChicagoLocal,
  publicBaseUrl,
  pushTemplate,
  type FollowUpStatus,
  withStore,
} from "@onehope/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isLanguage } from "@/lib/i18n";

async function setSession(token: string) {
  const jar = await cookies();
  jar.set("onehope_session", token, sessionCookie());
}

/** Host-only cookie. It stays on the app host (app.weareonehope.com later) and is not shared with www. */
function sessionCookie() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: publicBaseUrl().startsWith("https://"),
  };
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
    const next = await withStore((store) => {
      const session = store.login({ email, password, ip: "command-center", userAgent: "staff-form" });
      if (session.mfaRequired && store.totpStatus(session.token) === "enroll") {
        return { token: session.token, enroll: true as const };
      }
      if (session.mfaRequired) {
        if (!/^\d{6}$/.test(code)) throw new AccessError("mfa_required", "Enter the 6-digit code.");
        store.verifyMfa(session.token, code);
        store.stepUp(session.token, { code });
      }
      return { token: session.token, enroll: false as const };
    });
    await setSession(next.token);
    if (next.enroll) redirect("/enroll");
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


export async function savePush(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  const template = pushTemplate(String(formData.get("template") ?? ""));
  const title = (template?.title ?? String(formData.get("title") ?? "")).trim();
  const body = (template?.body ?? String(formData.get("body") ?? "")).trim();
  const segment = formData.get("segment");
  if (segment !== "members" && segment !== "volunteers" && segment !== "parents") redirect("/push?error=1");
  if (!title || !body) redirect("/push?error=1");
  const confirm = formData.get("confirm") === "yes";
  const result = await withStore((store) => store.sendPush(token, { title, body, segment, confirm }));
  if (result.needsConfirm) {
    const params = new URLSearchParams({
      confirm: "1",
      title,
      body,
      segment,
      count: String(result.count),
    });
    redirect(`/push?${params.toString()}`);
  }
  redirect(`/push?saved=1&sent=${result.sent ? "1" : "0"}`);
}

function isFollowUpStatus(value: unknown): value is FollowUpStatus {
  return typeof value === "string" && (FOLLOW_UP_STATUSES as readonly string[]).includes(value);
}

export async function saveSocialAction(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  const ids = formData.getAll("id").map(String);
  const names = formData.getAll("name").map(String);
  const urls = formData.getAll("url").map(String);
  const links = ids
    .map((id, index) => ({ id, name: names[index] ?? "", url: urls[index] ?? "" }))
    .filter((link) => link.url.trim());
  try {
    await withStore((store) => store.setSocialLinks(token, links));
  } catch {
    redirect("/overview?error=1");
  }
  redirect("/overview");
}

export async function addPersonAction(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  const displayName = String(formData.get("displayName") ?? "");
  const email = String(formData.get("email") ?? "");
  const phone = String(formData.get("phone") ?? "");
  let person: { id: string; displayName: string; inviteToken: string; expires: number };
  try {
    person = await withStore((store) => store.addPerson(token, { displayName, email, phone }));
  } catch {
    redirect("/people?error=1");
  }
  const params = new URLSearchParams({
    added: person.inviteToken,
    id: person.id,
    expires: String(person.expires),
    name: person.displayName,
  });
  redirect(`/people?${params.toString()}`);
}

export async function editPersonAction(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  const phone = String(formData.get("phone") ?? "");
  await withStore((store) => store.editPerson(token, id, { displayName, phone }));
  redirect("/people");
}

export async function moderatePrayerAction(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const approved = formData.get("approved") === "yes";
  await withStore((store) => store.moderatePrayer(token, id, approved));
  redirect("/care");
}


export async function neighborhoodPrayerAction(formData: FormData) {
  const body = String(formData.get("body") ?? "");
  try {
    await withStore((store) => store.submitNeighborhoodPrayer(body, "web-neighborhood"));
  } catch {
    redirect("/neighborhood?error=1");
  }
  redirect("/neighborhood?sent=1");
}

export async function updateFollowUpAction(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (!id || !isFollowUpStatus(status)) redirect("/care?error=1");
  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  const dueAt = dueRaw ? parseChicagoLocal(dueRaw) : null;
  if (dueRaw && dueAt === null) redirect("/care?error=time");
  const assigneeRaw = String(formData.get("assigneeId") ?? "");
  try {
    await withStore((store) =>
      store.updateFollowUp(token, id, {
        status,
        assigneeId: formData.has("assigneeId") ? (assigneeRaw ? assigneeRaw : null) : undefined,
        dueAt: formData.has("dueAt") ? dueAt : undefined,
        staffNote: formData.has("staffNote") ? String(formData.get("staffNote") ?? "") : undefined,
      }),
    );
  } catch (error) {
    if (error instanceof AccessError) redirect("/care?error=1");
    throw error;
  }
  redirect("/care?saved=1");
}
