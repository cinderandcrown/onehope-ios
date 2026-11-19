"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { GivingFrequency } from "@onehope/server";

type Notify = (message: string) => void;

async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
  return { ok: response.ok, data };
}

/** Parses "25", "25.5", or "$1,250.00" into cents; anything else is null. */
export function toCents(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 && cents <= 10_000_000 ? cents : null;
}

/**
 * Native giving with the Church Center frequencies. Shown only when giving is
 * switched on with Stripe keys; giving needs a fresh password confirmation.
 */
export function GiveInApp({
  funds,
  frequencies,
  signedIn,
  onNotice,
}: {
  funds: { id: string; name: string }[];
  frequencies: readonly { id: GivingFrequency; label: string }[];
  signedIn: boolean;
  onNotice: Notify;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [fundId, setFundId] = useState(funds[0]?.id ?? "");
  const [recurring, setRecurring] = useState<GivingFrequency>("once");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!signedIn) {
    return (
      <article className="card">
        <h2>Give in the app</h2>
        <p>Sign in under Connect to give here, or use online giving above.</p>
      </article>
    );
  }
  async function give() {
    const amountCents = toCents(amount);
    if (amountCents === null) {
      onNotice("Enter an amount like 25 or 25.50.");
      return;
    }
    setBusy(true);
    if (needsPassword) {
      const confirmed = await post("/api/auth/step-up", { password });
      setPassword("");
      if (!confirmed.ok) {
        setBusy(false);
        onNotice(confirmed.data.error || "That password didn't match.");
        return;
      }
      setNeedsPassword(false);
    }
    const { ok, data } = await post("/api/giving/gifts", { amountCents, fundId, recurring });
    setBusy(false);
    if (!ok && data.code === "step_up_required") {
      setNeedsPassword(true);
      onNotice("Confirm your password to give.");
      return;
    }
    if (!ok) {
      onNotice(data.error || "That gift didn't go through. Please try again.");
      return;
    }
    const frequency = frequencies.find((item) => item.id === recurring)?.label ?? "";
    onNotice(`Thank you. Your gift is set up (${frequency.toLowerCase()}).`);
    setAmount("");
    router.refresh();
  }
  return (
    <form
      className="form card"
      onSubmit={(event) => {
        event.preventDefault();
        void give();
      }}
    >
      <h2>Give in the app</h2>
      <label>
        Amount
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
      </label>
      <label>
        Fund
        <select value={fundId} onChange={(event) => setFundId(event.target.value)}>
          {funds.map((fund) => (
            <option key={fund.id} value={fund.id}>
              {fund.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Frequency
        <select value={recurring} onChange={(event) => setRecurring(event.target.value as GivingFrequency)}>
          {frequencies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {needsPassword ? (
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      ) : null}
      <button className="button" type="submit" disabled={busy}>
        Give
      </button>
    </form>
  );
}
