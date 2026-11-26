"use server";

import { isAccessError } from "@onehope/server";
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

function fail(path: string, error: unknown): never {
  if (isAccessError(error) && (error.code === "unauthenticated" || error.code === "session_expired")) {
    redirect("/login");
  }
  const code = isAccessError(error) && error.code === "step_up_required" ? "stepup" : "invalid";
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}error=${code}`);
}

export async function uploadImportAction(form: FormData) {
  const session = await token();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/import?error=file");
  const name = file.name || "people.csv";
  let text = "";
  try {
    text = await file.text();
  } catch {
    redirect("/import?error=file");
  }
  let id = "";
  try {
    id = await withChurch((store) => store.receivePeopleFile(session, { filename: name, text }).id, {
      token: session,
    });
  } catch (error) {
    fail("/import", error);
  }
  redirect(`/import?id=${encodeURIComponent(id)}&step=match`);
}

export async function saveMappingAction(form: FormData) {
  const session = await token();
  const id = field(form, "id");
  const count = Number.parseInt(field(form, "columns"), 10);
  const chosen: string[] = [];
  for (let index = 0; index < count; index += 1) chosen.push(field(form, `field_${index}`));
  const back = `/import?id=${encodeURIComponent(id)}&step=match`;
  try {
    await withChurch((store) => store.setPeopleImportMapping(session, id, chosen), { token: session });
  } catch (error) {
    fail(back, error);
  }
  redirect(`/import?id=${encodeURIComponent(id)}&step=preview`);
}

export async function commitImportAction(form: FormData) {
  const session = await token();
  const id = field(form, "id");
  const back = `/import?id=${encodeURIComponent(id)}&step=preview`;
  try {
    await withChurch((store) => store.commitPeopleImport(session, id), { token: session });
  } catch (error) {
    fail(back, error);
  }
  redirect(`/import?id=${encodeURIComponent(id)}&step=summary`);
}

export async function undoImportAction(form: FormData) {
  const session = await token();
  const id = field(form, "id");
  const back = `/import?id=${encodeURIComponent(id)}&step=summary`;
  try {
    await withChurch((store) => store.undoPeopleImport(session, id), { token: session });
  } catch (error) {
    fail(back, error);
  }
  redirect(`${back}&saved=undone`);
}

export async function mergePeopleAction(form: FormData) {
  const session = await token();
  const keptId = field(form, "keptId");
  const mergedId = field(form, "mergedId");
  try {
    await withChurch((store) => store.mergePeople(session, keptId, mergedId), { token: session });
  } catch (error) {
    fail("/duplicates", error);
  }
  redirect("/duplicates?saved=merged");
}

export async function dismissDuplicateAction(form: FormData) {
  const session = await token();
  try {
    await withChurch((store) => store.dismissDuplicate(session, field(form, "leftId"), field(form, "rightId")), {
      token: session,
    });
  } catch (error) {
    fail("/duplicates", error);
  }
  redirect("/duplicates?saved=different");
}

export async function undoMergeAction(form: FormData) {
  const session = await token();
  try {
    await withChurch((store) => store.undoMerge(session, field(form, "id")), { token: session });
  } catch (error) {
    fail("/duplicates", error);
  }
  redirect("/duplicates?saved=undone");
}
