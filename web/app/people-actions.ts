"use server";

import { isAccessError, type ChurchStore } from "@onehope/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { withChurch } from "@/lib/church";

async function token() {
  const jar = await cookies();
  const value = jar.get("onehope_session")?.value;
  if (!value) redirect("/login");
  return value;
}

function field(form: FormData, key: string) {
  return String(form.get(key) ?? "");
}

/** Short codes only, so nothing personal ever lands in the address bar. */
function errorCode(error: unknown): string {
  if (!isAccessError(error)) return "failed";
  if (error.message.includes("not to contact")) return "dnc";
  if (error.message.includes("already a tag")) return "duplicate";
  if (error.message.includes("under")) return "long";
  if (error.code === "forbidden") return "forbidden";
  if (error.code === "not_found") return "missing";
  return "invalid";
}

async function run(back: string, fn: (store: ChurchStore, session: string) => unknown, saved = "1") {
  const session = await token();
  let failure = "";
  try {
    await withChurch((store) => fn(store, session), { token: session });
  } catch (error) {
    if (isAccessError(error) && (error.code === "unauthenticated" || error.code === "session_expired")) {
      redirect("/login");
    }
    failure = errorCode(error);
  }
  const join = back.includes("?") ? "&" : "?";
  redirect(failure ? `${back}${join}error=${failure}` : `${back}${join}saved=${saved}`);
}

function personPath(form: FormData) {
  const id = field(form, "personId");
  return `/person/${encodeURIComponent(id)}`;
}

export async function setStageAction(form: FormData) {
  await run(personPath(form), (store, session) =>
    store.setPersonStage(session, field(form, "personId"), field(form, "stage")),
  );
}

export async function logTouchAction(form: FormData) {
  await run(
    personPath(form),
    (store, session) =>
      store.logTouch(session, field(form, "personId"), {
        kind: field(form, "kind"),
        outcome: field(form, "outcome"),
        note: field(form, "note"),
      }),
    "touch",
  );
}

export async function tagPersonAction(form: FormData) {
  await run(personPath(form), (store, session) =>
    store.tagPerson(session, field(form, "personId"), field(form, "tagId")),
  );
}

export async function untagPersonAction(form: FormData) {
  await run(personPath(form), (store, session) =>
    store.untagPerson(session, field(form, "personId"), field(form, "tagId")),
  );
}

export async function allowContactAction(form: FormData) {
  await run(personPath(form), (store, session) => store.allowContactAgain(session, field(form, "personId")));
}

export async function createTagAction(form: FormData) {
  await run("/people", (store, session) =>
    store.createTag(session, {
      name: field(form, "name"),
      kind: field(form, "kind"),
      leaderIds: form.getAll("leaderIds").map(String),
    }),
  );
}

export async function archiveTagAction(form: FormData) {
  await run("/people", (store, session) => store.archiveTag(session, field(form, "tagId")));
}

export async function saveListAction(form: FormData) {
  await run(
    "/people",
    (store, session) =>
      store.saveList(session, {
        name: field(form, "name"),
        shared: field(form, "shared") === "yes",
        stage: field(form, "stage"),
        tagIds: field(form, "tag") ? [field(form, "tag")] : [],
        faithSteps: field(form, "faith") ? [field(form, "faith")] : [],
        source: field(form, "source"),
        ownerId: field(form, "owner"),
        seen: field(form, "seen"),
        contact: field(form, "contact"),
        task: field(form, "task"),
        quiet: field(form, "quiet") === "1",
      }),
    "list",
  );
}

export async function deleteListAction(form: FormData) {
  await run("/people", (store, session) => store.deleteList(session, field(form, "id")), "list");
}

export async function removePersonAction(form: FormData) {
  if (field(form, "confirm") !== "yes") redirect(`${personPath(form)}?error=confirm`);
  const session = await token();
  let failure = "";
  try {
    await withChurch((store) => store.removePerson(session, field(form, "personId")), { token: session });
  } catch (error) {
    if (isAccessError(error) && (error.code === "unauthenticated" || error.code === "session_expired")) {
      redirect("/login");
    }
    failure = isAccessError(error) && error.code === "step_up_required" ? "stepup" : errorCode(error);
  }
  redirect(failure ? `${personPath(form)}?error=${failure}` : "/people?saved=removed");
}
