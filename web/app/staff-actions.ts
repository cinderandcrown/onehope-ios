"use server";

import {
  ROLES,
  announcementTemplate,
  type ChurchStore,
  type Role,
  eventTemplate,
  isAccessError,
  nextChurchMoment,
  parseChicagoLocal,
  serveTemplate,
} from "@onehope/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { withChurch } from "@/lib/church";
import { setFlash } from "@/lib/flash";
import { clearIssued, rememberIssued } from "@/lib/issued-code";

function desk<T>(token: string, fn: (store: ChurchStore) => Promise<T> | T) {
  return withChurch(fn, { token });
}

async function staffToken() {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  return token;
}

function fail(path: string, error: unknown): never {
  if (isAccessError(error)) redirect(`${path}?error=1`);
  throw error;
}

async function checkinFail(error: unknown): Promise<never> {
  const message = isAccessError(error) ? error.message : "That did not work. Check the code and try again.";
  await setFlash({ desk: "checkin", tone: "error", message });
  redirect("/checkin");
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
    await desk(token, (store) => store.createAnnouncement(token, { title, body, ...window }));
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
    await desk(token, (store) => store.updateAnnouncement(token, id, { title, body, ...window }));
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
    await desk(token, (store) =>
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
    await desk(token, (store) =>
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
    await desk(token, (store) => store.cancelEvent(token, id, cancelled));
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
    await desk(token, (store) =>
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
    await desk(token, (store) =>
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
    await desk(token, (store) => store.cancelOutreach(token, id, cancelled));
  } catch (error) {
    fail("/events", error);
  }
  redirect("/events?saved=1");
}

export async function undoPersonAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  try {
    await desk(token, (store) => store.undoAddPerson(token, id));
  } catch (error) {
    fail("/people", error);
  }
  await clearIssued();
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
    await desk(token, (store) => store.changeRole(token, { personId, role }));
  } catch (error) {
    fail(next, error);
  }
  redirect(`${next}?saved=1`);
}

export async function confirmTotpAction(formData: FormData) {
  const token = await staffToken();
  const code = String(formData.get("code") ?? "");
  try {
    await desk(token, (store) => store.confirmTotp(token, code));
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
    invite = await desk(token, (store) => store.issueInvite(token, email));
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
    await desk(token, (store) =>
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
    await desk(token, (store) => store.clearFeaturedMessage(token));
  } catch (error) {
    fail("/media", error);
  }
  redirect("/media?saved=1");
}

export async function assignServingAction(formData: FormData) {
  const token = await staffToken();
  const personId = String(formData.get("personId") ?? "");
  const position = String(formData.get("position") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  try {
    await desk(token, (store) => store.assignServing(token, { personId, position, positionId }));
  } catch (error) {
    fail("/serving", error);
  }
  redirect("/serving?saved=1");
}

export async function undoServingAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  try {
    await desk(token, (store) => store.undoServing(token, id));
  } catch (error) {
    fail("/serving", error);
  }
  redirect("/serving?saved=1");
}

export async function clockInAction() {
  const token = await staffToken();
  try {
    await desk(token, (store) => store.clockIn(token));
  } catch (error) {
    await checkinFail(error);
    throw error;
  }
  await setFlash({ desk: "checkin", tone: "saved", message: "You are clocked in." });
  redirect("/checkin");
}

export async function clockOutAction() {
  const token = await staffToken();
  try {
    await desk(token, (store) => store.clockOut(token));
  } catch (error) {
    await checkinFail(error);
    throw error;
  }
  await setFlash({ desk: "checkin", tone: "saved", message: "You are clocked out." });
  redirect("/checkin");
}

export async function staffCheckInAction(formData: FormData) {
  const token = await staffToken();
  const childId = String(formData.get("childId") ?? "");
  try {
    await desk(token, (store) => store.staffCheckIn(token, childId));
  } catch (error) {
    await checkinFail(error);
    throw error;
  }
  await setFlash({ desk: "checkin", tone: "saved", message: "Checked in. Read the code on this screen. Nothing was texted." });
  redirect(`/checkin?label=${encodeURIComponent(childId)}`);
}

export async function stationPickupAction(formData: FormData) {
  const token = await staffToken();
  const childId = String(formData.get("childId") ?? "");
  const guardianPersonId = String(formData.get("guardianPersonId") ?? "");
  const code = String(formData.get("code") ?? "");
  let result: { allowed: boolean; reason: string };
  try {
    result = await desk(token, (store) => store.pickup(token, { childId, guardianPersonId, code }));
  } catch (error) {
    await checkinFail(error);
    throw error;
  }
  if (!result.allowed) {
    await setFlash({ desk: "checkin", tone: "error", message: result.reason });
    redirect("/checkin");
  }
  await setFlash({ desk: "checkin", tone: "saved", message: "Saved. The child is with their adult." });
  redirect("/checkin");
}

export async function moderateTestimonyAction(formData: FormData) {
  const token = await staffToken();
  const id = String(formData.get("id") ?? "");
  const approved = formData.get("approved") === "yes";
  try {
    await desk(token, (store) => store.moderateTestimony(token, id, approved));
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
    await desk(token, (store) => store.stepUp(token, { code }));
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
    await desk(token, (store) => store.archiveAnnouncement(token, id, archived));
  } catch (error) {
    fail("/communications", error);
  }
  redirect("/communications?saved=1");
}

export async function addKidsTeamAction(formData: FormData) {
  const token = await staffToken();
  const personId = String(formData.get("personId") ?? "");
  try {
    await desk(token, (store) => store.addKidsTeamMember(token, personId));
  } catch (error) {
    await checkinFail(error);
    throw error;
  }
  await setFlash({ desk: "checkin", tone: "saved", message: "Added to the kids team." });
  redirect("/checkin");
}

export async function removeKidsTeamAction(formData: FormData) {
  const token = await staffToken();
  const personId = String(formData.get("personId") ?? "");
  try {
    await desk(token, (store) => store.removeKidsTeamMember(token, personId));
  } catch (error) {
    await checkinFail(error);
    throw error;
  }
  await setFlash({ desk: "checkin", tone: "saved", message: "Removed from the kids team." });
  redirect("/checkin");
}
