import { CHURCH, zonedParts, zonedTimeToUtc } from "./domain";
import { CHURCH_ADDRESS } from "./church-copy";

/** Home cards the church can post. Times are optional and interpreted in America/Chicago. */
export type AnnouncementCard = {
  id: string;
  title: string;
  body: string;
  sample: boolean;
  startsAt?: number | null;
  endsAt?: number | null;
  archived?: boolean;
  /** Set when a person saved this card, so the built-in Sunday and Kids cards are not written back over it. */
  staffEdited?: boolean;
};

export const ANNOUNCEMENT_TEMPLATES = [
  {
    id: "sunday",
    title: "Sunday at 10:30",
    body: "Join us this Sunday at 10:30 a.m. Come early for donuts and coffee.",
  },
  {
    id: "kids",
    title: "Kids check-in is open",
    body: "One Hope Kids is open Sunday during the gathering, from 3 months through 5th grade. Check in at the kids desk.",
  },
  {
    id: "prayer",
    title: "Prayer night",
    body: "Join us for prayer night. Come as you are.",
  },
] as const;

export type AnnouncementTemplateId = (typeof ANNOUNCEMENT_TEMPLATES)[number]["id"];

export function announcementTemplate(id: string): (typeof ANNOUNCEMENT_TEMPLATES)[number] | null {
  return ANNOUNCEMENT_TEMPLATES.find((item) => item.id === id) ?? null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const EVENT_TEMPLATES = [
  {
    id: "sunday",
    title: "Sunday gathering",
    location: CHURCH_ADDRESS,
    detail: "Worship at 10:30 a.m. Come early for donuts and coffee.",
    weekday: "Sun",
    hour: 10,
    minute: 30,
    durationMin: 90,
  },
  {
    id: "prayer",
    title: "Prayer night",
    location: CHURCH_ADDRESS,
    detail: "Come as you are. We will pray together.",
    weekday: "Wed",
    hour: 18,
    minute: 30,
    durationMin: 90,
  },
] as const;

export const PUSH_TEMPLATES = [
  {
    id: "sunday",
    title: "Sunday at 10:30",
    body: "We're gathering Sunday at 10:30 a.m. Come early for coffee.",
  },
  {
    id: "kids",
    title: "Kids check-in is open",
    body: "Kids check-in is open. Stop by the kids desk when you arrive.",
  },
  {
    id: "prayer",
    title: "Prayer night",
    body: "Prayer night is tonight. Come as you are.",
  },
] as const;

export function pushTemplate(id: string): (typeof PUSH_TEMPLATES)[number] | null {
  return PUSH_TEMPLATES.find((item) => item.id === id) ?? null;
}

export const SERVE_TEMPLATES = [
  {
    id: "neighborhood",
    title: "Serve the neighborhood",
    location: "Church lobby",
    detail: "Meet at the church and go out together.",
    weekday: "Sat",
    hour: 9,
    minute: 0,
    durationMin: 120,
  },
] as const;

export function eventTemplate(id: string): (typeof EVENT_TEMPLATES)[number] | null {
  return EVENT_TEMPLATES.find((item) => item.id === id) ?? null;
}

export function serveTemplate(id: string): (typeof SERVE_TEMPLATES)[number] | null {
  return SERVE_TEMPLATES.find((item) => item.id === id) ?? null;
}

/** The next Central-time occurrence of a weekday and clock time, at least a minute from now. */
export function nextChurchMoment(
  now: number,
  input: { weekday: "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"; hour: number; minute: number; durationMin: number },
): { start: number; end: number } {
  const parts = zonedParts(new Date(now), CHURCH.timeZone);
  const idx = WEEKDAYS.indexOf(parts.weekday as (typeof WEEKDAYS)[number]);
  const want = WEEKDAYS.indexOf(input.weekday);
  let add = (want - (idx < 0 ? 0 : idx) + 7) % 7;
  const civilOn = (days: number) => {
    const civil = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
    return zonedTimeToUtc(
      civil.getUTCFullYear(),
      civil.getUTCMonth() + 1,
      civil.getUTCDate(),
      input.hour,
      input.minute,
      CHURCH.timeZone,
    ).getTime();
  };
  if (add === 0 && now >= civilOn(0)) add = 7;
  const start = civilOn(add);
  return { start, end: start + input.durationMin * 60 * 1000 };
}

/** A card is on Home when it is not archived and now falls inside its Central window. Blank times mean "show it". */
export function announcementIsLive(card: AnnouncementCard, now: number): boolean {
  if (card.archived) return false;
  if (card.startsAt != null && now < card.startsAt) return false;
  if (card.endsAt != null && now > card.endsAt) return false;
  return true;
}

export function windowError(startsAt: number | null, endsAt: number | null): string | null {
  if (startsAt != null && endsAt != null && endsAt <= startsAt) {
    return "This card ends before it starts. Put the end after the start.";
  }
  return null;
}

/**
 * `2026-11-22T10:30` or `2026-11-22` as America/Chicago wall time.
 * Returns null when the text is not a date the form would send.
 */
export function parseChicagoLocal(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? "0");
  const minute = Number(match[5] ?? "0");
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return zonedTimeToUtc(year, month, day, hour, minute, CHURCH.timeZone).getTime();
}

export function formatChicago(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHURCH.timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);
}

/** Value for `<input type="datetime-local">`, still in Central time. */
export function chicagoInputValue(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHURCH.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
}
