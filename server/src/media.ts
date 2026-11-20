import { z } from "zod";

/**
 * Runtime church media: photos, team, ministry cards and the Revival gallery.
 * Nothing here ships in git. The values come from the ONEHOPE_MEDIA_JSON env
 * var (tenant config) and point at the church's own public hosted images.
 * Every URL must be https; anything else is dropped so the apps fall back to
 * their brand-colored placeholder.
 */

export const LEGACY_IMAGE_SLOTS = ["hero", "about", "video", "revival", "og"] as const;

export type ChurchImages = Record<string, string> & {
  hero: string;
  about: string;
  video: string;
  revival: string;
  og: string;
};

export type TeamMember = { id: string; name: string; role: string; photo: string };
export type MinistryCard = { id: string; title: string; blurb: string; photo: string; url: string };
export type GalleryPhoto = { id: string; caption: string; url: string };

export type CreditLine = { title: string; detail: string; url: string };

export type ChurchMedia = {
  team: TeamMember[];
  ministries: MinistryCard[];
  revival: { gallery: GalleryPhoto[] };
  /** Who made or owns the pictures and other material shown, for the About & Credits screen. */
  credits: CreditLine[];
};

export const EMPTY_MEDIA: ChurchMedia = { team: [], ministries: [], revival: { gallery: [] }, credits: [] };

const MAX_URL = 600;

export function httpsURL(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw.startsWith("https://") || raw.length > MAX_URL) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : "";
  } catch {
    return "";
  }
}

const text = (max: number) => z.string().trim().max(max);
const SLOT_NAME = /^[a-z0-9_]{1,32}$/;
const itemId = z.string().regex(/^[a-z0-9-]{1,40}$/);

const mediaSchema = z.object({
  images: z.record(z.string(), z.string()).default({}),
  team: z
    .array(z.object({ id: itemId, name: text(80), role: text(120), photo: z.string() }))
    .max(60)
    .default([]),
  ministries: z
    .array(
      z.object({
        id: itemId,
        title: text(60),
        blurb: text(220),
        photo: z.string().default(""),
        url: z.string().default(""),
      }),
    )
    .max(24)
    .default([]),
  revival: z
    .object({
      gallery: z
        .array(z.object({ id: itemId, caption: text(120), url: z.string() }))
        .max(24)
        .default([]),
    })
    .default({ gallery: [] }),
  credits: z
    .array(z.object({ title: text(80), detail: text(300).default(""), url: z.string().default("") }))
    .max(20)
    .default([]),
});

export function blankImages(): ChurchImages {
  return { hero: "", about: "", video: "", revival: "", og: "" };
}

/** Image slots from the legacy ONEHOPE_IMAGE_* vars, then the media JSON on top. */
export function churchImages(env: NodeJS.ProcessEnv): ChurchImages {
  return mergeImages(env, loadMedia(env).images);
}

function mergeImages(env: NodeJS.ProcessEnv, extra: Record<string, string>): ChurchImages {
  const images = blankImages();
  for (const slot of LEGACY_IMAGE_SLOTS) images[slot] = httpsURL(env[`ONEHOPE_IMAGE_${slot.toUpperCase()}`]);
  for (const [name, value] of Object.entries(extra)) {
    const url = httpsURL(value);
    if (url && SLOT_NAME.test(name)) images[name] = url;
  }
  return images;
}

type Loaded = ChurchMedia & { images: Record<string, string> };

export function loadMedia(env: NodeJS.ProcessEnv): Loaded {
  const raw = (env.ONEHOPE_MEDIA_JSON ?? "").trim();
  const none: Loaded = { ...EMPTY_MEDIA, images: {} };
  if (!raw) return none;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return none;
  }
  const parsed = mediaSchema.safeParse(json);
  if (!parsed.success) return none;
  const value = parsed.data;
  const images: Record<string, string> = {};
  for (const [name, url] of Object.entries(value.images).slice(0, 60)) {
    if (!SLOT_NAME.test(name)) continue;
    const clean = httpsURL(url);
    if (clean) images[name] = clean;
  }
  return {
    images,
    team: value.team
      .map((member) => ({ ...member, photo: httpsURL(member.photo) }))
      .filter((member) => member.name.length > 0),
    ministries: value.ministries
      .map((card) => ({ ...card, photo: httpsURL(card.photo), url: httpsURL(card.url) }))
      .filter((card) => card.title.length > 0),
    revival: {
      gallery: value.revival.gallery
        .map((photo) => ({ ...photo, url: httpsURL(photo.url) }))
        .filter((photo) => photo.url.length > 0),
    },
    credits: value.credits
      .map((credit) => ({ ...credit, url: httpsURL(credit.url) }))
      .filter((credit) => credit.title.length > 0),
  };
}

export function churchMedia(env: NodeJS.ProcessEnv): { images: ChurchImages; media: ChurchMedia } {
  const loaded = loadMedia(env);
  return {
    images: mergeImages(env, loaded.images),
    media: {
      team: loaded.team,
      ministries: loaded.ministries,
      revival: loaded.revival,
      credits: loaded.credits,
    },
  };
}

/** The tenant these photos belong to. Other tenants on the same deploy get the fallback look. */
export function mediaTenant(env: NodeJS.ProcessEnv): string {
  return (env.ONEHOPE_MEDIA_TENANT ?? "").trim() || "onehope";
}
