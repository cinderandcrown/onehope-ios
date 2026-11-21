"use client";

import { setLanguage } from "@/app/actions";

import { ThemeToggle } from "./theme-toggle";

export function HeaderTools({ language, light, dark }: { language: string; light: string; dark: string }) {
  return (
    <div className="header-tools">
      <form action={setLanguage}>
        <label>
          Language
          <select
            name="language"
            defaultValue={language}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      </form>
      <ThemeToggle light={light} dark={dark} />
    </div>
  );
}
