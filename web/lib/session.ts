import { isAccessError } from "@onehope/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { withChurch } from "./church";
import { isLanguage, type Language } from "./i18n";

export async function staffSession() {
  const jar = await cookies();
  const token = jar.get("onehope_session")?.value;
  if (!token) redirect("/login");
  try {
    const person = await withChurch((store) => store.staffMe(token), { token });
    const rawLanguage = jar.get("onehope_lang")?.value;
    const language: Language = isLanguage(rawLanguage) ? rawLanguage : "en";
    return { token, person, language };
  } catch (error) {
    if (isAccessError(error)) redirect(error.code === "forbidden" ? "/login?error=member" : "/login");
    throw error;
  }
}
