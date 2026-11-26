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

/** Only known paths go back into the address bar. */
function backTo(form: FormData, fallback: string) {
  const back = field(form, "back");
  if (back === "/tasks" || back === "/tasks?team=1" || back === "/playbooks") return back;
  if (/^\/person\/[A-Za-z0-9_-]+$/.test(back)) return back;
  return fallback;
}

async function run(back: string, fn: (store: ChurchStore, session: string) => unknown, saved: string) {
  const session = await token();
  let failure = "";
  try {
    await withChurch((store) => fn(store, session), { token: session });
  } catch (error) {
    if (isAccessError(error) && (error.code === "unauthenticated" || error.code === "session_expired")) {
      redirect("/login");
    }
    failure = isAccessError(error)
      ? error.code === "forbidden"
        ? "forbidden"
        : error.code === "not_found"
          ? "missing"
          : "invalid"
      : "failed";
  }
  const join = back.includes("?") ? "&" : "?";
  redirect(failure ? `${back}${join}error=${failure}` : `${back}${join}saved=${saved}`);
}

export async function completeTaskAction(form: FormData) {
  const outcome = field(form, "outcome");
  await run(
    backTo(form, "/tasks"),
    (store, session) =>
      store.completeTask(session, field(form, "taskId"), { outcome, note: field(form, "note") }),
    outcome === "unreached" ? "retry" : outcome === "skipped" ? "skipped" : "done",
  );
}

export async function reassignTaskAction(form: FormData) {
  await run(
    backTo(form, "/tasks?team=1"),
    (store, session) => store.reassignTask(session, field(form, "taskId"), field(form, "assigneeId")),
    "moved",
  );
}

export async function togglePlaybookAction(form: FormData) {
  const active = field(form, "active") === "on";
  await run(
    "/playbooks",
    (store, session) => store.setPlaybookActive(session, field(form, "playbookId"), active),
    active ? "on" : "off",
  );
}
