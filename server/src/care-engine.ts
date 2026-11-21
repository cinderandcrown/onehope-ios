/**
 * Phase 2b: the care engine. Playbooks turn a next step (a first visit, a decision for Jesus) into a short
 * list of tasks for care team seats. Every playbook ships switched off; only a pastor turns one on.
 * Nothing here sends a message. Scripts are suggestions staff copy and send themselves.
 */
import type { FollowUpKind } from "./faith";

export const PLAYBOOK_TRIGGERS = ["first_visit", "salvation"] as const;
export type PlaybookTrigger = (typeof PLAYBOOK_TRIGGERS)[number];

export const TASK_CHANNELS = ["call", "text", "card", "visit", "prayer"] as const;
export type TaskChannel = (typeof TASK_CHANNELS)[number];

export const CHANNEL_LABELS: Record<TaskChannel, string> = {
  call: "Call",
  text: "Text",
  card: "Card",
  visit: "Visit",
  prayer: "Pray",
};

export type PlaybookStep = {
  /** Days after the next step came in. 0 means the same day. */
  day: number;
  /** Hours instead of days, for the first salvation call. */
  withinHours?: number;
  title: string;
  channel: TaskChannel;
  /** `{first name}` and `{your name}` are filled in when the task is shown. */
  script: string;
};

export type PlaybookDefinition = {
  id: string;
  trigger: PlaybookTrigger;
  name: string;
  summary: string;
  steps: readonly PlaybookStep[];
};

/** Written for One Hope. A pastor can turn these on; until then they do nothing. */
export const DEFAULT_PLAYBOOKS: readonly PlaybookDefinition[] = [
  {
    id: "playbook-salvation",
    trigger: "salvation",
    name: "Said yes to Jesus",
    summary: "Someone tells us they decided to follow Jesus. The first call happens within 24 hours.",
    steps: [
      {
        day: 0,
        withinHours: 24,
        title: "Celebrate and pray with them",
        channel: "call",
        script:
          "Hi {first name}, this is {your name} from One Hope Church. We heard you said yes to Jesus, and we are celebrating with you! Could I pray with you right now? What would help you most this week?",
      },
      {
        day: 1,
        title: "Get them a Bible and their first steps",
        channel: "visit",
        script:
          "Hi {first name}! We have a Bible and a short first-steps guide set aside for you. Can we hand it to you Sunday, or drop it by this week?",
      },
      {
        day: 3,
        title: "Connect them with a mentor or group",
        channel: "call",
        script:
          "Hi {first name}, it's {your name} from One Hope. Walking with Jesus is better with friends. Could we introduce you to someone who would love to meet up for coffee?",
      },
      {
        day: 10,
        title: "Talk about baptism",
        channel: "call",
        script:
          "Hi {first name}, have you thought about being baptized? It's a simple way to tell the world you belong to Jesus. I'd love to answer any questions.",
      },
      {
        day: 30,
        title: "Check in on their walk",
        channel: "text",
        script:
          "Hi {first name}, it's {your name} from One Hope. How is your walk with Jesus going? We are praying for you.",
      },
    ],
  },
  {
    id: "playbook-first-visit",
    trigger: "first_visit",
    name: "First visit",
    summary: "Someone plans a visit or is new to One Hope. A warm welcome over their first week.",
    steps: [
      {
        day: 0,
        title: "Welcome call or text",
        channel: "text",
        script:
          "Hi {first name}, this is {your name} from One Hope Church. We're so glad you're joining us! Is there anything we can pray about for you this week?",
      },
      {
        day: 2,
        title: "Send a handwritten card",
        channel: "card",
        script:
          "Dear {first name}, thank you for worshiping with us. You were made on purpose, and we'd love to see you again soon.",
      },
      {
        day: 4,
        title: "Coffee on us",
        channel: "text",
        script:
          "Hi {first name}! Your next coffee at Revival Coffee is on us. Just tell the barista your name before service this Sunday.",
      },
      {
        day: 7,
        title: "Invite them back",
        channel: "call",
        script:
          "Hi {first name}, it's {your name} from One Hope. We'd love to save you a seat this Sunday at 10:30. Is there anything we can help with?",
      },
    ],
  },
];

/** When someone did not ask to be contacted, the only task is prayer. */
export const PRAYER_ONLY_STEP: PlaybookStep = {
  day: 0,
  title: "Pray for them",
  channel: "prayer",
  script:
    "Pray for {first name} by name. They did not ask to be contacted, so we wait for them to reach out.",
};

export function triggerFor(kind: FollowUpKind): PlaybookTrigger | null {
  if (kind === "salvation") return "salvation";
  if (kind === "visit" || kind === "new") return "first_visit";
  return null;
}

/** A pastor's saved choice for one playbook. Steps come from the code above. */
export type PlaybookRow = {
  id: string;
  trigger: PlaybookTrigger;
  active: boolean;
  updatedBy: string;
  updatedAt: number;
};

export const TASK_STATUSES = ["open", "done", "skipped", "unreached"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_OUTCOMES = ["done", "unreached", "skipped"] as const;
export type TaskOutcome = (typeof TASK_OUTCOMES)[number];

/** After this many "couldn't reach" tries the task closes on its own. */
export const MAX_ATTEMPTS = 3;

export type CareTaskRow = {
  id: string;
  personId: string | null;
  followUpId: string | null;
  playbookId: string | null;
  step: number;
  title: string;
  channel: TaskChannel;
  /** Always a care team seat, or null when the church has none yet. */
  assigneeId: string | null;
  dueAt: number;
  status: TaskStatus;
  attempts: number;
  createdAt: number;
  completedAt: number | null;
  completedBy: string | null;
  /** Encrypted `{ note }`, or empty. */
  noteCiphertext: string;
};

export function isTaskOutcome(value: unknown): value is TaskOutcome {
  return typeof value === "string" && (TASK_OUTCOMES as readonly string[]).includes(value);
}

export function dueAtFor(start: number, step: PlaybookStep): number {
  const hour = 60 * 60 * 1000;
  return step.withinHours !== undefined ? start + step.withinHours * hour : start + step.day * 24 * hour;
}

export function firstName(name: string): string {
  const trimmed = name.trim();
  return trimmed.split(/\s+/)[0] || "friend";
}

/** Fills the two placeholders. Anything else is left exactly as written. */
export function fillScript(script: string, values: { firstName: string; yourName: string }): string {
  return script.replaceAll("{first name}", values.firstName).replaceAll("{your name}", values.yourName);
}

const DAY = 24 * 60 * 60 * 1000;

/** Start of the church's local day (America/Chicago) for `now`. */
export function chicagoDayStart(now: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const elapsed = ((get("hour") * 60 + get("minute")) * 60 + get("second")) * 1000 + (now % 1000);
  return now - elapsed;
}

export type TaskBucket = "overdue" | "today" | "week" | "later";

export function bucketFor(dueAt: number, now: number): TaskBucket {
  if (dueAt < now) return "overdue";
  const start = chicagoDayStart(now);
  if (dueAt < start + DAY) return "today";
  if (dueAt < start + 7 * DAY) return "week";
  return "later";
}

/** Fair round-robin: the care seat with the fewest open tasks, ties by id so it is stable. */
export function pickCareSeat(
  seatIds: readonly string[],
  openCounts: ReadonlyMap<string, number>,
): string | null {
  if (seatIds.length === 0) return null;
  return [...seatIds].sort((left, right) => {
    const diff = (openCounts.get(left) ?? 0) - (openCounts.get(right) ?? 0);
    return diff !== 0 ? diff : left.localeCompare(right);
  })[0]!;
}
