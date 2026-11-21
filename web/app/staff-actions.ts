"use server";

import { AccessError, announcementTemplate, parseChicagoLocal, withStore } from "@onehope/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function staffToken() {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  return token;
}

function fail(path: string, error: unknown): never {
  if (error instanceof AccessError) redirect(`${path}?error=1`);
  throw error;
}

function windowFrom(formData: FormData): { startsAt: number | null; endsAt: number | null } {
  const startsRaw = String(formData.get("startsAt") ?? "").trim();
  const endsRaw = String(formData.get("endsAt") ?? "").trim();
  const startsAt = startsRaw ? parseChicagoLocal(startsRaw) : null;
  const endsAt = endsRaw ? parseChicagoLocal(endsRaw) : null;
  if ((startsRaw && startsAt === null) || (endsRaw && endsAt === null)) {
    redirect("/communications?error=time");
  }
  return { startsAt, endsAt };
}

export async function postAnnouncementAction(formData: FormData) {
  const token = await staffToken();
  const template = announcementTemplate(String(formData.get("template") ?? ""));
  const title = template?.title ?? String(formData.get("title") ?? "");
  const body = template?.body ?? String(formData.get("body") ?? "");
  const window = template ? { startsAt: null, endsAt: null } : windowFrom(formData);
  try {
    await withStore((store) => store.createAnnouncement(token, { title, body, ...window }));
  } catch (error) {
    fail("/communications", error);
  }
  redirect("/communications?saved=1");
}

export async function updateAnnouncementAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");
  const window = windowFrom(formData);
  try {
    await withStore((store) => store.updateAnnouncement(token, id, { title, body, ...window }));
  } catch (error) {
    fail("/communications", error);
  }
  redirect("/communications?saved=1");
}

export async function archiveAnnouncementAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") !== "no";
  try {
    await withStore((store) => store.archiveAnnouncement(token, id, archived));
  } catch (error) {
    fail("/communications", error);
  }
  redirect("/communications?saved=1");
}
