"use server";

import {
  AccessError,
  ROLES,
  announcementTemplate,
  type Role,
  eventTemplate,
  nextChurchMoment,
  parseChicagoLocal,
  serveTemplate,
  withStore,
} from "@onehope/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { clearIssued, rememberIssued } from "@/lib/issued-code";

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

function checkinFail(error: unknown): never {
  const message =
    error instanceof AccessError ? error.message : "That did not work. Check the code and try again.";
  redirect(`/checkin?notice=${encodeURIComponent(message)}`);
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

function scheduleFrom(formData: FormData, errorPath: string): { start: number; end: number } {
  const start = parseChicagoLocal(String(formData.get("start") ?? ""));
  const end = parseChicagoLocal(String(formData.get("end") ?? ""));
  if (start === null || end === null || end <= start) redirect(`${errorPath}?error=time`);
  return { start, end };
}

function capacityFrom(formData: FormData): number | null {
  const raw = String(formData.get("capacity") ?? "").trim();
  if (!raw) return null;
  const capacity = Number(raw);
  if (!Number.isInteger(capacity) || capacity < 1) redirect("/events?error=capacity");
  return capacity;
}

export async function postEventAction(formData: FormData) {
  const token = await staffToken();
  const template = eventTemplate(String(formData.get("template") ?? ""));
  const timing = template
    ? nextChurchMoment(Date.now(), template)
    : scheduleFrom(formData, "/events");
  const title = template?.title ?? String(formData.get("title") ?? "");
  const location = template?.location ?? String(formData.get("location") ?? "");
  const description = template?.detail ?? String(formData.get("description") ?? "");
  const capacity = template ? null : capacityFrom(formData);
  try {
    await withStore((store) =>
      store.createEvent(token, { title, location, description, capacity, ...timing }),
    );
  } catch (error) {
    fail("/events", error);
  }
  redirect("/events?saved=1");
}

export async function updateEventAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  const timing = scheduleFrom(formData, "/events");
  try {
    await withStore((store) =>
      store.updateEvent(token, id, {
        title: String(formData.get("title") ?? ""),
        location: String(formData.get("location") ?? ""),
        description: String(formData.get("description") ?? ""),
        capacity: capacityFrom(formData),
        ...timing,
      }),
    );
  } catch (error) {
    fail("/events", error);
  }
  redirect("/events?saved=1");
}

export async function cancelEventAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  const cancelled = formData.get("cancelled") !== "no";
  try {
    await withStore((store) => store.cancelEvent(token, id, cancelled));
  } catch (error) {
    fail("/events", error);
  }
  redirect("/events?saved=1");
}

export async function postServeAction(formData: FormData) {
  const token = await staffToken();
  const template = serveTemplate(String(formData.get("template") ?? ""));
  const timing = template
    ? nextChurchMoment(Date.now(), template)
    : scheduleFrom(formData, "/events");
  try {
    await withStore((store) =>
      store.createOutreach(token, {
        title: template?.title ?? String(formData.get("title") ?? ""),
        location: template?.location ?? String(formData.get("location") ?? ""),
        detail: template?.detail ?? String(formData.get("detail") ?? ""),
        ...timing,
      }),
    );
  } catch (error) {
    fail("/events", error);
  }
  redirect("/events?saved=1");
}

export async function updateServeAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  const timing = scheduleFrom(formData, "/events");
  try {
    await withStore((store) =>
      store.updateOutreach(token, id, {
        title: String(formData.get("title") ?? ""),
        location: String(formData.get("location") ?? ""),
        detail: String(formData.get("detail") ?? ""),
        ...timing,
      }),
    );
  } catch (error) {
    fail("/events", error);
  }
  redirect("/events?saved=1");
}

export async function cancelServeAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  const cancelled = formData.get("cancelled") !== "no";
  try {
    await withStore((store) => store.cancelOutreach(token, id, cancelled));
  } catch (error) {
    fail("/events", error);
  }
  redirect("/events?saved=1");
}

export async function undoPersonAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  try {
    await withStore((store) => store.undoAddPerson(token, id));
  } catch (error) {
    fail("/people", error);
  }
  redirect("/people?saved=1");
}

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export async function changeRoleAction(formData: FormData) {
  const token = await staffToken();
  const personId = String(formData.get("personId") ?? "");
  const role = String(formData.get("role") ?? "");
  const next = formData.get("next") === "/security" ? "/security" : "/people";
  if (!isRole(role)) redirect(`${next}?error=1`);
  try {
    await withStore((store) => store.changeRole(token, { personId, role }));
  } catch (error) {
    fail(next, error);
  }
  redirect(`${next}?saved=1`);
}

export async function confirmTotpAction(formData: FormData) {
  const token = await staffToken();
  const code = String(formData.get("code") ?? "");
  try {
    await withStore((store) => store.confirmTotp(token, code));
  } catch (error) {
    fail("/enroll", error);
  }
  redirect("/overview");
}

export async function issueInviteAction(formData: FormData) {
  const token = await staffToken();
  const email = String(formData.get("email") ?? "");
  let invite: { inviteToken: string; expires: number; displayName: string };
  try {
    invite = await withStore((store) => store.issueInvite(token, email));
  } catch (error) {
    fail("/security", error);
  }
  await rememberIssued({
    code: invite.inviteToken,
    name: invite.displayName,
    expires: invite.expires,
    desk: "security",
  });
  redirect("/security");
}

export async function clearIssuedAction(formData: FormData) {
  await clearIssued();
  const desk = formData.get("desk") === "security" ? "/security" : "/people";
  redirect(desk);
}

export async function featureMessageAction(formData: FormData) {
  const token = await staffToken();
  try {
    await withStore((store) =>
      store.featureMessage(token, {
        videoId: String(formData.get("videoId") ?? ""),
        title: String(formData.get("title") ?? ""),
        speaker: String(formData.get("speaker") ?? ""),
        passage: String(formData.get("passage") ?? ""),
        link: String(formData.get("link") ?? ""),
        thumbnail: String(formData.get("thumbnail") ?? ""),
      }),
    );
  } catch (error) {
    fail("/media", error);
  }
  redirect("/media?saved=1");
}

export async function clearFeatureAction() {
  const token = await staffToken();
  try {
    await withStore((store) => store.clearFeaturedMessage(token));
  } catch (error) {
    fail("/media", error);
  }
  redirect("/media?saved=1");
}

export async function assignServingAction(formData: FormData) {
  const token = await staffToken();
  const personId = String(formData.get("personId") ?? "");
  const position = String(formData.get("position") ?? "");
  try {
    await withStore((store) => store.assignServing(token, { personId, position }));
  } catch (error) {
    fail("/serving", error);
  }
  redirect("/serving?saved=1");
}

export async function undoServingAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  try {
    await withStore((store) => store.undoServing(token, id));
  } catch (error) {
    fail("/serving", error);
  }
  redirect("/serving?saved=1");
}

export async function clockInAction() {
  const token = await staffToken();
  try {
    await withStore((store) => store.clockIn(token));
  } catch (error) {
    checkinFail(error);
  }
  redirect("/checkin");
}

export async function clockOutAction() {
  const token = await staffToken();
  try {
    await withStore((store) => store.clockOut(token));
  } catch (error) {
    checkinFail(error);
  }
  redirect("/checkin");
}

export async function staffCheckInAction(formData: FormData) {
  const token = await staffToken();
  const childId = String(formData.get("childId") ?? "");
  try {
    await withStore((store) => store.staffCheckIn(token, childId));
  } catch (error) {
    checkinFail(error);
  }
  redirect(`/checkin?label=${encodeURIComponent(childId)}`);
}

export async function stationPickupAction(formData: FormData) {
  const token = await staffToken();
  const childId = String(formData.get("childId") ?? "");
  const guardianPersonId = String(formData.get("guardianPersonId") ?? "");
  const code = String(formData.get("code") ?? "");
  let result: { allowed: boolean; reason: string };
  try {
    result = await withStore((store) => store.pickup(token, { childId, guardianPersonId, code }));
  } catch (error) {
    checkinFail(error);
  }
  if (!result.allowed) redirect(`/checkin?notice=${encodeURIComponent(result.reason)}`);
  redirect("/checkin?saved=1");
}

export async function moderateTestimonyAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  const approved = formData.get("approved") === "yes";
  try {
    await withStore((store) => store.moderateTestimony(token, id, approved));
  } catch (error) {
    fail("/care", error);
  }
  redirect("/care?saved=1");
}

export async function confirmStepUpAction(formData: FormData) {
  const token = await staffToken();
  const code = String(formData.get("code") ?? "");
  const next = String(formData.get("next") ?? "/care");
  const section = next.startsWith("/") ? next.slice(1) : "";
  if (!/^[a-z]+$/.test(section)) redirect("/care?error=1");
  try {
    await withStore((store) => store.stepUp(token, { code }));
  } catch (error) {
    fail(next, error);
  }
  redirect(next);
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
