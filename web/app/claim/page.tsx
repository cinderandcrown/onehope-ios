import { claimAccountAction } from "@/app/claim-actions";

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const error = (await searchParams).error;
  const message =
    error === "match"
      ? "Those passwords don't match. Type the same one twice."
      : error === "short"
        ? "Use at least 8 characters."
        : error
          ? "That code didn't work. Check the email and the code, and ask the church if it expired."
          : "";
  return (
    <main className="public-page">
      <p className="muted">One Hope</p>
      <h1>Set your password</h1>
      <p className="help">
        Someone at the church read you a code. Type it here with the email they used, then choose a password.
        This page does not email you.
      </p>
      {message ? <p className="notice">{message}</p> : null}
      <form className="form" action={claimAccountAction}>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Invite code
          <input name="inviteToken" autoComplete="one-time-code" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label>
          Password again
          <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <button className="button" type="submit">
          Save password
        </button>
      </form>
    </main>
  );
}
