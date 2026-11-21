import Image from "next/image";
import type { ReactNode } from "react";
import { headers } from "next/headers";

import { signOut } from "@/app/actions";
import { HeaderTools } from "@/components/header-tools";
import { canOpenSection } from "@/lib/desk-access";
import { copy, isSectionId, navGroups } from "@/lib/i18n";
import { staffSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const { person, language } = await staffSession();
  const text = copy(language);
  const path = (await headers()).get("x-pathname") ?? "";
  return (
    <>
      <a className="skip" href="#content">
        {text.skip}
      </a>
      <div className="shell">
        <aside className="rail">
          <div className="brand">
            <Image src="/brand/wordmark-dove.png" alt="One Hope" width={220} height={60} />
            <p>{text.product}</p>
          </div>
          <nav aria-label={text.product}>
            {navGroups.map((group) => {
              const items = group.items.filter((item) => canOpenSection(person.role, item));
              if (items.length === 0) return null;
              return (
                <div className="nav-group" key={group.id}>
                  {items.map((item) => (
                    <a key={item} href={`/${item}`} aria-current={path === `/${item}` ? "page" : undefined}>
                      {text[item]}
                    </a>
                  ))}
                </div>
              );
            })}
          </nav>
          <form action={signOut}>
            <button className="text-button" type="submit">
              {text.signOut}
            </button>
          </form>
          <p className="muted">
            {person.displayName}
            {person.sample ? ` · ${text.sample}` : ""}
          </p>
        </aside>
        <div className="main">
          <div className="topbar">
            <HeaderTools language={language} light={text.light} dark={text.dark} />
          </div>
          <div id="content">{children}</div>
        </div>
      </div>
    </>
  );
}

export function sectionOrNull(value: string) {
  return isSectionId(value) ? value : null;
}
