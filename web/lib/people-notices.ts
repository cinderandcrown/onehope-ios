const SAVED: Record<string, string> = {
  "1": "Saved.",
  touch: "Logged. It is on their timeline now.",
  done: "Done. Thank you for reaching out.",
  retry: "Okay. It is back on the list for tomorrow.",
  skipped: "Skipped.",
  removed: "Removed. Their care records were erased; the audit log keeps a note that it happened.",
  moved: "Moved to another care team seat.",
  on: "Playbook is on. New next steps will create tasks for the care team.",
  off: "Playbook is off. No new tasks will be created. Open tasks stay on the list.",
};

const ERRORS: Record<string, string> = {
  dnc: "They asked us not to contact them. You can still pray for them or add a private note.",
  duplicate: "There is already a tag with that name.",
  long: "That note is too long. Keep it under 2,000 characters.",
  forbidden: "That is not yours to change.",
  missing: "That person or tag is not here, or is not in your area.",
  invalid: "That did not work. Check what you picked and try again.",
  failed: "That did not work. Try again.",
  confirm: "Tick the box to confirm first.",
  stepup: "Confirm it's you again (sign in again), then try once more.",
};

export function peopleNotice(query: Record<string, string | string[] | undefined>) {
  const pick = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  };
  const error = pick("error");
  if (error && ERRORS[error]) return { tone: "error" as const, text: ERRORS[error] };
  const saved = pick("saved");
  if (saved && SAVED[saved]) return { tone: "saved" as const, text: SAVED[saved] };
  return null;
}

export function lastContactLabel(at: number | null, format: (value: number) => string) {
  return at ? format(at) : "Not yet";
}
