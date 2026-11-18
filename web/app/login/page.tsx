import Image from "next/image";
import Link from "next/link";

import { copy, isLanguage } from "@/lib/i18n";
import { previewSampleStaff, signIn } from "@/app/actions";
import { cookies } from "next/headers";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const jar = await cookies();
  const rawLanguage = jar.get("onehope_lang")?.value;
  const text = copy(isLanguage(rawLanguage) ? rawLanguage : "en");
  return (
    <main className="login">
      <section className="login-copy">
        <Image src="/brand/wordmark-ink.png" alt="One Hope" width={280} height={76} priority />
        <p className="muted">{text.product}</p>
        <h1>One Hope</h1>
        <p>1251 S. Sherman St., Ste. 112, Richardson, TX. Sundays at 10:30 a.m.</p>
        {process.env.ONEHOPE_SAMPLE_DATA === "true" ? (
          <form action={previewSampleStaff}>
            <button className="button" type="submit">
              {text.preview}
            </button>
          </form>
        ) : null}
        <p className="muted">Staff sign in with email, password, and an authentication code.</p>
        <p className="muted">
          <Link href="/member">Open the member demo</Link>. It can be added to a phone home screen.
        </p>
        <form className="form" action={signIn}>
          <label>
            {text.email}
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            {text.password}
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <label>
            {text.code}
            <input name="code" inputMode="numeric" autoComplete="one-time-code" aria-describedby="mfa-help" />
          </label>
          <p id="mfa-help" className="muted">
            Staff enter a 6-digit code. Sample staff can use the preview button instead.
          </p>
          {params.error ? (
            <p className="error">That sign-in did not go through. Check the email, password, and code.</p>
          ) : null}
          <button className="button" type="submit">
            {text.signIn}
          </button>
        </form>
      </section>
      <Image
        className="login-photo"
        src="/photos/hero.jpg"
        alt="A parent and child from the One Hope site"
        width={1400}
        height={816}
        priority
      />
    </main>
  );
}
