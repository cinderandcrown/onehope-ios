import { publicBaseUrl } from "@onehope/server";
import { cookies } from "next/headers";

const NAME = "onehope_issued";

export type IssuedCode = {
  code: string;
  name: string;
  expires: number;
  personId?: string;
  desk: "people" | "security";
};

function options() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
    secure: publicBaseUrl().startsWith("https://"),
  };
}

/** Keeps a fresh invite off the URL so it does not land in logs or history. */
export async function rememberIssued(value: IssuedCode) {
  const jar = await cookies();
  jar.set(NAME, JSON.stringify(value), options());
}

export async function readIssued(desk: IssuedCode["desk"]): Promise<IssuedCode | null> {
  const jar = await cookies();
  const raw = jar.get(NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IssuedCode;
    if (parsed.desk !== desk || typeof parsed.code !== "string" || !parsed.code) return null;
    if (typeof parsed.name !== "string" || typeof parsed.expires !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearIssued() {
  const jar = await cookies();
  jar.delete(NAME);
}
