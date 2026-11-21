import { CHURCH, zonedTimeToUtc } from "./domain";

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

/** A card is on Home when it is not archived and now falls inside its Central window. Blank times mean "show it". */
export function announcementIsLive(card: AnnouncementCard, now: number): boolean {
  if (card.archived) return false;
  if (card.startsAt != null && now < card.startsAt) return false;
  if (card.endsAt != null && now > card.endsAt) return false;
  return true;
}

export function windowError(startsAt: number | null, endsAt: number | null): string | null {
  if (startsAt != null && endsAt != null && endsAt <= startsAt) {
    return "The end has to be after the start.";
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
