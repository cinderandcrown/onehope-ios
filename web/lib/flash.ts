import { cookies } from "next/headers";
import { publicBaseUrl } from "@onehope/server";

const NAME = "onehope_flash";

export type DeskFlash = {
  desk: "checkin" | "push";
  tone: "error" | "saved" | "confirm";
  message?: string;
  title?: string;
  body?: string;
  segment?: string;
  count?: string;
};

function options() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 120,
    secure: publicBaseUrl().startsWith("https://"),
  };
}

/** A one-screen note that never lands in the URL. */
export async function setFlash(value: DeskFlash) {
  const jar = await cookies();
  jar.set(NAME, JSON.stringify(value), options());
}

export async function readFlash(desk: DeskFlash["desk"]): Promise<DeskFlash | null> {
  const jar = await cookies();
  const raw = jar.get(NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DeskFlash;
    if (parsed.desk !== desk) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearFlash() {
  const jar = await cookies();
  jar.delete(NAME);
}
