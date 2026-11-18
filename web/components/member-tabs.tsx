"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { deleteMember } from "@/app/member/actions";

type Tab = "Home" | "Watch" | "Give" | "Connect" | "More";

export type MemberVideo = { id: string; title: string; thumbnail: string | null };
export type MemberEvent = { id: string; title: string; detail: string; start: number; end: number; registered: boolean };

export type MemberDemo = {
  churchName: string;
  address: string;
  pastors: string;
  service: string;
  announcements: { id: string; title: string; body: string }[];
  events: MemberEvent[];
  videos: MemberVideo[];
  groups: { id: string; name: string; summary: string; joined: boolean }[];
  prayers: { id: string; body: string; approved: boolean; mine: boolean }[];
  kids: { id: string; displayName: string; classroom: string }[];
  pathway: { id: string; title: string; status: string }[];
  serving: { id: string; position: string; status: string }[];
  directory: { id: string; displayName: string; email: string; phone: string }[];
  accountName: string;
  accountEmail: string;
  emailPublic: boolean;
  phonePublic: boolean;
  listedInDirectory: boolean;
  givingOpen: boolean;
};

const TABS: Tab[] = ["Home", "Watch", "Give", "Connect", "More"];
const CLASSROOMS = ["Nursery", "Preschool", "Elementary"];

export function MemberTabs({
  demo,
  initialTab = "Home",
  initialNotice = "",
}: {
  demo: MemberDemo;
  initialTab?: Tab;
  initialNotice?: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [notice, setNotice] = useState(initialNotice);
  return (
    <main className="member">
      <h1>{tab}</h1>
      {notice ? <p role="status">{notice}</p> : null}
      {tab === "Home" ? <Home demo={demo} /> : null}
      {tab === "Watch" ? <Watch demo={demo} /> : null}
      {tab === "Give" ? <Give demo={demo} /> : null}
      {tab === "Connect" ? <Connect demo={demo} onNotice={setNotice} /> : null}
      {tab === "More" ? <More demo={demo} onNotice={setNotice} /> : null}
      <nav className="member-tabs" aria-label="Member sections" role="tablist">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => {
              setNotice("");
              setTab(name);
            }}
          >
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
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </article>
      ))}
      <h2>Upcoming</h2>
      {demo.events.length === 0 ? <p>No events are listed yet.</p> : null}
      {demo.events.map((event) => (
        <article className="card" key={event.id}>
          <h3>{event.title}</h3>
          <p>{event.detail}</p>
          <p>{new Date(event.start).toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
        </article>
      ))}
    </>
  );
}

function Watch({ demo }: { demo: MemberDemo }) {
  const [selected, setSelected] = useState(demo.videos[0]?.id ?? "");
  const current = demo.videos.find((video) => video.id === selected) ?? demo.videos[0];
  return (
    <>
      {current ? (
        <iframe
          title={current.title}
          src={`https://www.youtube.com/embed/${current.id}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <p>Sunday messages will appear here.</p>
      )}
      {demo.videos.map((video) => (
        <button key={video.id} type="button" className="card" onClick={() => setSelected(video.id)}>
          {video.thumbnail ? <Image src={video.thumbnail} alt="" width={320} height={180} /> : null}
          <span>{video.title}</span>
        </button>
      ))}
    </>
  );
}

function Give({ demo }: { demo: MemberDemo }) {
  if (!demo.givingOpen) return <p>Giving opens soon.</p>;
  return (
    <form className="form">
      <label>
        Amount
        <input name="amount" inputMode="decimal" />
      </label>
      <label>
        Fund
        <select name="fund" defaultValue="general">
          <option value="general">General</option>
          <option value="outreach">Outreach</option>
          <option value="kids">Kids</option>
          <option value="benevolence">Benevolence</option>
        </select>
      </label>
    </form>
  );
}

function Connect({ demo, onNotice }: { demo: MemberDemo; onNotice: (message: string) => void }) {
  const router = useRouter();
  const [prayer, setPrayer] = useState("");
  const [note, setNote] = useState("");
  const [childName, setChildName] = useState("");
  const [classroom, setClassroom] = useState("Preschool");
  const joined = demo.groups.filter((group) => group.joined);
  async function act(path: string, body?: Record<string, unknown>, success?: string) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
    if (!response.ok) {
      onNotice(data.error || "That didn't go through. Please try again.");
      return data;
    }
    if (success) onNotice(success);
    router.refresh();
    return data;
  }
  return (
    <>
      <section>
        <h2>Groups</h2>
        {demo.groups.map((group) => (
          <article className="card" key={group.id}>
            <h3>{group.name}</h3>
            <p>{group.summary}</p>
            <button
              type="button"
              className="button"
              onClick={() =>
                void act(
                  `/api/groups/${group.id}/${group.joined ? "leave" : "join"}`,
                  {},
                  group.joined ? "You left the group." : "You're in that group.",
                )
              }
            >
              {group.joined ? "Leave" : "Join"}
            </button>
          </article>
        ))}
      </section>
      <section>
        <h2>Group note</h2>
        {joined.length === 0 ? <p>Join a group before sending a note.</p> : null}
        <textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={joined.length === 0} />
        <button
          type="button"
          className="button"
          disabled={joined.length === 0}
          onClick={() => {
            const body = note.trim();
            if (!body) {
              onNotice("Write a note before sending it.");
              return;
            }
            const group = joined[0];
            if (!group) return;
            void act(`/api/groups/${group.id}/messages`, { body }, "Your note was sent.");
            setNote("");
          }}
        >
          {joined[0] ? `Send to ${joined[0].name}` : "Send"}
        </button>
      </section>
      <section>
        <h2>Events</h2>
        {demo.events.map((event) => (
          <article className="card" key={event.id}>
            <h3>{event.title}</h3>
            <p>{event.detail}</p>
            <button
              type="button"
              className="button"
              disabled={event.registered}
              onClick={() => void act(`/api/events/${event.id}/register`, {}, "You're registered.")}
            >
              {event.registered ? "Registered" : "Register"}
            </button>
            <a href={`/api/events/${event.id}/ics`}>Add to calendar</a>
          </article>
        ))}
      </section>
      <section>
        <h2>Prayer</h2>
        <textarea value={prayer} onChange={(event) => setPrayer(event.target.value)} />
        <button
          type="button"
          className="button"
          onClick={() => {
            const body = prayer.trim();
            if (!body) {
              onNotice("Write a prayer before sharing it.");
              return;
            }
            void act("/api/prayers", { body, visibility: "public" }, "Your prayer was sent to the pastors.");
            setPrayer("");
          }}
        >
          Share a prayer
        </button>
        {demo.prayers.map((item) => (
          <article className="card" key={item.id}>
            <p>{item.body}</p>
            {item.mine && !item.approved ? <p>Waiting for pastor approval</p> : null}
          </article>
        ))}
      </section>
      <section>
        <h2>Kids check-in</h2>
        <input value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="Child's name" />
        <select value={classroom} onChange={(event) => setClassroom(event.target.value)}>
          {CLASSROOMS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <button
          type="button"
          className="button"
          onClick={() => {
            const displayName = childName.trim();
            if (!displayName) {
              onNotice("Enter your child's name.");
              return;
            }
            void act("/api/household/children", { displayName, classroom }, `${displayName} was added.`);
            setChildName("");
          }}
        >
          Add child
        </button>
        {demo.kids.map((child) => (
          <article className="card" key={child.id}>
            <h3>{child.displayName}</h3>
            <p>{child.classroom}</p>
            <button
              type="button"
              className="button"
              onClick={() => {
                void (async () => {
                  const response = await fetch("/api/kids/check-in", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ childId: child.id }),
                  });
                  const data = (await response.json()) as { code?: string; error?: string };
                  onNotice(response.ok && data.code ? `Security code ${data.code}` : data.error || "Check-in didn't go through.");
                  if (response.ok) router.refresh();
                })();
              }}
            >
              Check in
            </button>
          </article>
        ))}
      </section>
      <section>
        <h2>Next steps</h2>
        {demo.pathway.length === 0 ? <p>Growth Track classes will show here when the church schedules them.</p> : null}
        {demo.pathway.map((step) => (
          <article className="card" key={step.id}>
            <h3>{step.title}</h3>
            <p>{step.status}</p>
          </article>
        ))}
      </section>
      <section>
        <h2>Serving</h2>
        {demo.serving.length === 0 ? <p>No assignment on this account.</p> : null}
        {demo.serving.map((item) => (
          <article className="card" key={item.id}>
            <h3>{item.position}</h3>
            <p>{item.status}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function DeleteAccount() {
  return (
    <form
      className="form"
      action={deleteMember}
      onSubmit={(event) => {
        if (!window.confirm("Delete your account? This removes your prayers, registrations, and children.")) {
          event.preventDefault();
        }
      }}
    >
      <label>
        Password to delete
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="button" type="submit">
        Delete my account
      </button>
    </form>
  );
}

function More({ demo, onNotice }: { demo: MemberDemo; onNotice: (message: string) => void }) {
  const router = useRouter();
  const [emailPublic, setEmailPublic] = useState(demo.emailPublic);
  const [phonePublic, setPhonePublic] = useState(demo.phonePublic);
  const [listed, setListed] = useState(demo.listedInDirectory);
  return (
    <>
      <article className="card">
        <h2>Account</h2>
        <p>{demo.accountName}</p>
        <p>{demo.accountEmail}</p>
        <DeleteAccount />
      </article>
      <section>
        <h2>Directory</h2>
        <label>
          <input type="checkbox" checked={emailPublic} onChange={(event) => setEmailPublic(event.target.checked)} /> Show
          my email
        </label>
        <label>
          <input type="checkbox" checked={phonePublic} onChange={(event) => setPhonePublic(event.target.checked)} /> Show
          my phone
        </label>
        <label>
          <input type="checkbox" checked={listed} onChange={(event) => setListed(event.target.checked)} /> List me in the
          directory
        </label>
        <button
          type="button"
          className="button"
          onClick={() => {
            void (async () => {
              const response = await fetch("/api/me", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ emailPublic, phonePublic, listedInDirectory: listed }),
              });
              const data = (await response.json().catch(() => ({}))) as { error?: string };
              onNotice(response.ok ? "Your privacy settings were saved." : data.error || "Those settings were not saved.");
              if (response.ok) router.refresh();
            })();
          }}
        >
          Save privacy
        </button>
        {demo.directory.length === 0 ? <p>People appear here when they choose to be listed.</p> : null}
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
