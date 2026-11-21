import { qrSvg, withStore } from "@onehope/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { confirmTotpAction } from "@/app/staff-actions";

export const dynamic = "force-dynamic";

export default async function EnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const token = (await cookies()).get("onehope_session")?.value;
  if (!token) redirect("/login");
  const error = (await searchParams).error;
  let setup: { setupKey: string; otpauthUrl: string };
  try {
    setup = await withStore((store) => store.beginTotp(token), { token });
  } catch {
    redirect("/overview");
  }
  const svg = await qrSvg(setup.otpauthUrl);
  return (
    <main className="public-page">
      <p className="muted">One Hope staff</p>
      <h1>Set up your code</h1>
      <p className="help">
        This is the first time you are signing in as staff. Open an authenticator app, scan the square, and
        type the 6-digit code it shows. If you cannot scan, type the setup key by hand. We do not text this
        code.
      </p>
      {error ? <p className="notice">That code did not match. Wait for a new one and try again.</p> : null}
      <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <p>
        Setup key: <strong className="setup-key">{setup.setupKey}</strong>
      </p>
      <form className="form" action={confirmTotpAction}>
        <label>
          6-digit code
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" required />
        </label>
        <button className="button" type="submit">
          Finish setup
        </button>
      </form>
    </main>
  );
}
