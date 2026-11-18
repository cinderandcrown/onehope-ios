"use client";

import { useState } from "react";

type Tab = "Home" | "Watch" | "Give" | "Connect" | "More";

export type MemberDemo = {
  churchName: string;
  address: string;
  pastors: string;
  service: string;
  announcements: { id: string; title: string; body: string; sample: boolean }[];
  events: { id: string; title: string; detail: string; sample: boolean }[];
  sermonTitle: string;
  sermonSample: boolean;
  sermonNote: string;
  groups: { id: string; name: string; summary: string; sample: boolean; joined: boolean }[];
  prayers: { id: string; body: string; sample: boolean }[];
  kids: { id: string; displayName: string; classroom: string; sample: boolean }[];
  pathway: { id: string; title: string; status: string }[];
  serving: { id: string; position: string; status: string; sample: boolean }[];
  directory: { id: string; displayName: string; email: string; phone: string }[];
  accountName: string;
  accountEmail: string;
  gifts: { id: string; fundName: string; amount: string; charged: boolean; sample: boolean }[];
  needsStepUp: boolean;
};

const TABS: Tab[] = ["Home", "Watch", "Give", "Connect", "More"];

export function MemberTabs({ demo }: { demo: MemberDemo }) {
  const [tab, setTab] = useState<Tab>("Home");
  return (
    <main className="member">
      <h1>{tab}</h1>
      {tab === "Home" ? <Home demo={demo} /> : null}
      {tab === "Watch" ? <Watch demo={demo} /> : null}
      {tab === "Give" ? <Give demo={demo} /> : null}
      {tab === "Connect" ? <Connect demo={demo} /> : null}
      {tab === "More" ? <More demo={demo} /> : null}
      <nav className="member-tabs" aria-label="Member sections" role="tablist">
        {TABS.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
            {name}
          </button>
        ))}
      </nav>
    </main>
  );
}

function Home({ demo }: { demo: MemberDemo }) {
  return (
    <>
      <h2>{demo.churchName}</h2>
      <p>{demo.address}</p>
      <p>Lead pastors {demo.pastors}.</p>
      <p>Next gathering {demo.service}.</p>
      {demo.announcements.map((item) => (
        <article className="card" key={item.id}>
          <h3>
            {item.title}
          </h3>
          <p>{item.body}</p>
        </article>
      ))}
      {demo.events.map((event) => (
        <article className="card" key={event.id}>
          <h3>
            {event.title}
          </h3>
          <p>{event.detail}</p>
        </article>
      ))}
    </>
  );
}

function Watch({ demo }: { demo: MemberDemo }) {
  return (
    <article className="card">
      <h2>
        {demo.sermonTitle}
      </h2>
      <p>{demo.sermonNote}</p>
    </article>
  );
}

function Give({ demo }: { demo: MemberDemo }) {
  return (
    <>
      <p>Demo mode. Apple Pay nonprofit approval is pending. This does not charge a card.</p>
      {demo.needsStepUp ? <p>Confirm it is you in the iPhone app before the amounts open.</p> : null}
      {demo.gifts.map((gift) => (
        <article className="card" key={gift.id}>
          <h3>
            {gift.fundName}
          </h3>
          <p>
            {gift.amount} · {gift.charged ? "Charged" : "Not charged"}
          </p>
        </article>
      ))}
    </>
  );
}

function Connect({ demo }: { demo: MemberDemo }) {
  return (
    <>
      <section>
        <h2>Next steps</h2>
        {demo.pathway.map((step) => (
          <article className="card" key={step.id}>
            <h3>
              {step.title}
            </h3>
            <p>{step.status}</p>
          </article>
        ))}
      </section>
      <section>
        <h2>Your kids</h2>
        <p className="muted">Allergies and security codes stay on the staff station.</p>
        {demo.kids.map((child) => (
          <article className="card" key={child.id}>
            <h3>
              {child.displayName}
            </h3>
            <p>{child.classroom}</p>
          </article>
        ))}
      </section>
      <section>
        <h2>Groups</h2>
        {demo.groups.map((group) => (
          <article className="card" key={group.id}>
            <h3>
              {group.name}
            </h3>
            <p>{group.summary}</p>
            <p>{group.joined ? "Joined" : "Not joined"}</p>
          </article>
        ))}
      </section>
      <section>
        <h2>Prayer</h2>
        {demo.prayers.map((prayer) => (
          <article className="card" key={prayer.id}>
            <p>
              {prayer.body}
            </p>
          </article>
        ))}
      </section>
      <section>
        <h2>Serving</h2>
        {demo.serving.length === 0 ? <p>No assignment on this account.</p> : null}
        {demo.serving.map((item) => (
          <article className="card" key={item.id}>
            <h3>
              {item.position}
            </h3>
            <p>{item.status}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function More({ demo }: { demo: MemberDemo }) {
  return (
    <>
      <article className="card">
        <h2>Account</h2>
        <p>{demo.accountName}</p>
        <p>{demo.accountEmail}</p>
      </article>
      <section>
        <h2>Directory</h2>
        {demo.directory.map((person) => (
          <article className="card" key={person.id}>
            <h3>{person.displayName}</h3>
            <p>{person.email || "Email hidden"}</p>
            <p>{person.phone || "Phone hidden"}</p>
          </article>
        ))}
      </section>
    </>
  );
}
