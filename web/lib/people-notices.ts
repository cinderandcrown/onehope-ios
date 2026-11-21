const SAVED: Record<string, string> = {
  "1": "Saved.",
  touch: "Logged. It is on their timeline now.",
};

const ERRORS: Record<string, string> = {
  dnc: "They asked us not to contact them. You can still pray for them or add a private note.",
  duplicate: "There is already a tag with that name.",
  long: "That note is too long. Keep it under 2,000 characters.",
  forbidden: "That is not yours to change.",
  missing: "That person or tag is not here, or is not in your area.",
  invalid: "That did not work. Check what you picked and try again.",
  failed: "That did not work. Try again.",
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
