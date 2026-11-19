"use client";

import { useState, useSyncExternalStore } from "react";

import type { ChurchStore } from "@onehope/server";

export type GrowthView = ReturnType<ChurchStore["growth"]>;

type Notify = (message: string) => void;
type NeedId = GrowthView["support"]["needs"][number]["id"];

/** The church's Support/Assistance Request, sent to the staff care queue. */
export function SupportForm({
  support,
  signedIn,
  onNotice,
}: {
  support: GrowthView["support"];
  signedIn: boolean;
  onNotice: Notify;
}) {
  const [needs, setNeeds] = useState<NeedId[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit() {
    const problem =
      needs.length === 0
        ? "Please check at least one box."
        : !signedIn && !name.trim()
          ? "Please tell us your name."
          : !signedIn && !email.trim() && !phone.trim()
            ? "Please leave an email or phone so we can reach you."
            : !consent
              ? "Check the box so we can contact you."
              : "";
    if (problem) {
      onNotice(problem);
      return;
    }
    setBusy(true);
    const body = signedIn
      ? { needs, consent }
      : { needs, name: name.trim(), email: email.trim(), phone: phone.trim(), consent };
    const response = await fetch("/api/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      onNotice(data.error || "That didn't go through. Please try again.");
      return;
    }
    setSent(true);
    setNeeds([]);
    onNotice("Thank you. Someone from One Hope will contact you soon.");
  }
  return (
    <section>
      <h2>{support.title}</h2>
      <p>{support.intro}</p>
      {sent ? <p className="muted">We received your request.</p> : null}
      <form
        className="form card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset>
          <legend>{support.prompt}</legend>
          {support.needs.map((need) => (
            <label key={need.id}>
              <input
                type="checkbox"
                checked={needs.includes(need.id)}
                onChange={(event) =>
                  setNeeds((current) =>
                    event.target.checked ? [...current, need.id] : current.filter((id) => id !== need.id),
                  )
                }
              />{" "}
              {need.label}
            </label>
          ))}
        </fieldset>
        {signedIn ? null : (
          <>
            <label>
              Your name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={80}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label>
              Phone
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
              />
            </label>
          </>
        )}
        <label>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />{" "}
          One Hope may contact me about this{signedIn ? " using my account email" : ""}.
        </label>
        <button className="button" type="submit" disabled={busy}>
          Send support request
        </button>
      </form>
    </section>
  );
}

/** The church's Toolkit for Spiritual Growth. Every link is one the church publishes. */
export function Toolkit({ toolkit }: { toolkit: GrowthView["toolkit"] }) {
  return (
    <section>
      <h2>{toolkit.title}</h2>
      <article className="card">
        <h3>{toolkit.readingPlan.title}</h3>
        <a className="button secondary" href={toolkit.readingPlan.url} target="_blank" rel="noreferrer">
          Open the reading plan
        </a>
      </article>
      <article className="card">
        <h3>Scriptures to speak</h3>
        {toolkit.scriptures.map((verse) => (
          <div key={verse.reference}>
            <blockquote>{verse.text}</blockquote>
            <p className="muted">{verse.reference} (KJV)</p>
          </div>
        ))}
      </article>
      <article className="card">
        <h3>{toolkit.proclamations.title}</h3>
        <a className="button secondary" href={toolkit.proclamations.url} target="_blank" rel="noreferrer">
          Open the daily proclamations
        </a>
      </article>
      <article className="card">
        <h3>Staff reads</h3>
        <ul>
          {toolkit.staffReads.map((book) => (
            <li key={book.title}>
              {book.title} <span className="muted">by {book.author}</span>
            </li>
          ))}
        </ul>
      </article>
      <article className="card">
        <h3>Podcast picks</h3>
        <ul>
          {toolkit.podcasts.map((podcast) => (
            <li key={podcast}>{podcast}</li>
          ))}
        </ul>
      </article>
      <article className="card">
        <h3>{toolkit.playlist.title}</h3>
        <a className="button secondary" href={toolkit.playlist.url} target="_blank" rel="noreferrer">
          Listen on Spotify
        </a>
      </article>
    </section>
  );
}

const WORKSHEET_KEY = "onehope.lifeEvaluation";

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readScores(raw: string): Record<string, number> {
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] >= 1 && entry[1] <= 10,
      ),
    );
  } catch {
    return {};
  }
}

/** Hope City Recovery. Worksheet answers are private and never leave this device. */
export function Recovery({
  recovery,
  onSupport,
}: {
  recovery: GrowthView["recovery"];
  onSupport: () => void;
}) {
  const stored = useSyncExternalStore(
    subscribeStorage,
    () => localStorage.getItem(WORKSHEET_KEY) ?? "",
    () => "",
  );
  const [edited, setEdited] = useState<Record<string, number> | null>(null);
  const scores = edited ?? readScores(stored);
  function save(next: Record<string, number>) {
    setEdited(next);
    try {
      localStorage.setItem(WORKSHEET_KEY, JSON.stringify(next));
    } catch {
      // Private browsing can refuse storage. The answers still show for this visit.
    }
  }
  const group = recovery.group;
  return (
    <section>
      <h2>
        {recovery.title}: {recovery.subtitle}
      </h2>
      {group ? (
        <article className="card">
          <h3>{group.name}</h3>
          <p>
            {group.schedule}
            {group.area ? ` · ${group.area}` : ""}
          </p>
          {group.leaders.length > 0 ? <p className="muted">Led by {group.leaders.join(" and ")}</p> : null}
          {group.url ? (
            <a className="button" href={group.url} target="_blank" rel="noreferrer">
              Ask to join on Church Center
            </a>
          ) : null}
        </article>
      ) : null}
      <article className="card">
        <h3>{recovery.worksheet.title}</h3>
        <p>{recovery.worksheet.prompt}</p>
        <p className="muted">Your answers stay on this device. They are not sent to the church.</p>
        {recovery.worksheet.areas.map((area) => (
          <label key={area} className="score">
            {area}: <strong>{scores[area] ?? "–"}</strong>
            <input
              type="range"
              min={1}
              max={10}
              value={scores[area] ?? 5}
              aria-label={area}
              onChange={(event) => save({ ...scores, [area]: Number(event.target.value) })}
            />
          </label>
        ))}
        <div className="cta-row">
          <a className="button secondary" href={recovery.worksheet.pdfUrl} target="_blank" rel="noreferrer">
            Printable worksheet
          </a>
          <button type="button" className="text-button" onClick={() => save({})}>
            Clear my answers
          </button>
        </div>
      </article>
      <button type="button" className="text-button" onClick={onSupport}>
        Want someone to talk with? Send a support request.
      </button>
    </section>
  );
}

const PANELS = ["Toolkit", "Recovery", "Support"] as const;

/** Toolkit, Recovery, and the Support/Assistance form, open to guests and members. */
export function Grow({
  growth,
  signedIn,
  onNotice,
}: {
  growth: GrowthView;
  signedIn: boolean;
  onNotice: Notify;
}) {
  const [panel, setPanel] = useState<(typeof PANELS)[number]>("Toolkit");
  return (
    <>
      <nav className="cta-row" aria-label="Grow">
        {PANELS.map((name) => (
          <button
            key={name}
            type="button"
            className={name === panel ? "button" : "button secondary"}
            aria-pressed={name === panel}
            onClick={() => setPanel(name)}
          >
            {name === "Support" ? "Care" : name}
          </button>
        ))}
      </nav>
      {panel === "Toolkit" ? <Toolkit toolkit={growth.toolkit} /> : null}
      {panel === "Recovery" ? (
        <Recovery recovery={growth.recovery} onSupport={() => setPanel("Support")} />
      ) : null}
      {panel === "Support" ? (
        <SupportForm support={growth.support} signedIn={signedIn} onNotice={onNotice} />
      ) : null}
    </>
  );
}
