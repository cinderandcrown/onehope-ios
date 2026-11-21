"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { ChurchImage } from "@/components/church-image";
import { respondServingAction } from "@/app/member/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { deleteMember, signInMember, signOutMember, signUpMember } from "@/app/member/actions";
import { FollowAlong, type SocialLink } from "@/components/follow-along";
import { GiveInApp } from "@/components/give-in-app";
import { Grow, type GrowthView } from "@/components/growth";
import { KidsCheckIn, type KidView } from "@/components/kids-check-in";
import type { ChurchStore, FollowUpKind, GivingFrequency } from "@onehope/server";

type Tab = "Home" | "Watch" | "Jesus" | "Give" | "Connect";
type View = Tab | "Visit";

type PublicHome = ReturnType<ChurchStore["publicHome"]>;
type KnowJesus = ReturnType<ChurchStore["knowJesus"]>;

export type MemberVideo = {
  id: string;
  title: string;
  thumbnail: string | null;
  published: string;
  link: string;
  kind: "message" | "short";
};

export type ChurchView = {
  churchName: string;
  address: string;
  pastors: string;
  service: string;
  announcements: { id: string; title: string; body: string }[];
  events: { id: string; title: string; detail: string; start: number; end: number; url: string | null }[];
  groups: ChurchGroup[];
  videos: MemberVideo[];
  visit: PublicHome["visit"];
  giving: PublicHome["giving"];
  invite: PublicHome["invite"];
  gospel: KnowJesus["gospel"];
  journey: KnowJesus["journey"];
  daily: ReturnType<ChurchStore["dailyWord"]>;
  givingOpen: boolean;
  funds: { id: string; name: string }[];
  frequencies: readonly { id: GivingFrequency; label: string }[];
  growth: GrowthView;
  social: SocialLink[];
  greeting: string;
  journeyMonth: KnowJesus["journey"];
  images: { hero: string; about: string; video: string; revival: string; og: string };
  featured: { title: string; speaker: string; passage: string; videoId: string } | null;
};

export type ChurchGroup = {
  id: string;
  name: string;
  summary: string;
  category: string | null;
  schedule: string;
  area: string;
  leaders: string[];
  joinType: "open" | "request";
  url: string | null;
  joined: boolean;
};

export type MemberView = {
  registeredEventIds: string[];
  prayers: {
    id: string;
    serve: string;
    body: string;
    contactRequested: boolean;
    approved: boolean;
    mine: boolean;
  }[];
  kids: KidView[];
  pathway: { id: string; title: string; status: string }[];
  serving: { id: string; position: string; status: string }[];
  directory: { id: string; displayName: string; email: string; phone: string }[];
  accountName: string;
  accountEmail: string;
  emailPublic: boolean;
  phonePublic: boolean;
  listedInDirectory: boolean;
};

type Notify = (message: string) => void;

const TABS: { id: Tab; label: string; name: string }[] = [
  { id: "Home", label: "Home", name: "Home" },
  { id: "Watch", label: "Watch", name: "Watch" },
  { id: "Jesus", label: "Jesus", name: "Know Jesus" },
  { id: "Give", label: "Give", name: "Give" },
  { id: "Connect", label: "Connect", name: "Connect" },
];
function TabIcon({ id }: { id: Tab }) {
  if (id === "Home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (id === "Watch") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 9.5v5l4.5-2.5-4.5-2.5z" fill="currentColor" />
      </svg>
    );
  }
  if (id === "Jesus") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v18M7 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "Give") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.5 18.5c.6-2.2 2.4-3.3 4.5-3.3s3.9 1.1 4.5 3.3M13.5 15.6c1.2-.5 2.5-.6 3.6-.2 1.5.5 2.4 1.6 2.8 3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const HEADINGS: Record<View, string> = {
  Home: "Home",
  Watch: "Watch",
  Jesus: "Know Jesus",
  Give: "Give",
  Connect: "Connect",
  Visit: "Plan a Visit",
};

export function MemberTabs({
  church,
  member,
  authError = "",
  initialTab = "Home",
  initialNotice = "",
}: {
  church: ChurchView;
  member: MemberView | null;
  authError?: string;
  initialTab?: Tab;
  initialNotice?: string;
}) {
  const [view, setView] = useState<View>(initialTab);
  const [notice, setNotice] = useState(initialNotice);
  const [videoId, setVideoId] = useState(church.videos.find((video) => video.kind === "message")?.id ?? "");
  const go = (next: View) => {
    setNotice("");
    setView(next);
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="phone">
      <main className="member">
        <h1 className={view === "Home" ? "member-logo-title" : "member-page-title"}>
          {view === "Home" ? (
            <Image src="/brand/logo.svg" alt="Home" width={164} height={44} priority />
          ) : (
            HEADINGS[view]
          )}
        </h1>
        {notice ? <p role="status">{notice}</p> : null}
        {view === "Home" ? (
          <Home
            church={church}
            signedIn={member !== null}
            onNotice={setNotice}
            onGo={go}
            onWatch={(id) => {
              setVideoId(id);
              go("Watch");
            }}
          />
        ) : null}
        {view === "Watch" ? (
          <Watch church={church} selected={videoId} onSelect={setVideoId} onNotice={setNotice} />
        ) : null}
        {view === "Jesus" ? (
          <KnowJesusView church={church} signedIn={member !== null} onNotice={setNotice} />
        ) : null}
        {view === "Give" ? <Give church={church} signedIn={member !== null} onNotice={setNotice} /> : null}
        {view === "Visit" ? (
          <PlanVisit church={church} signedIn={member !== null} onNotice={setNotice} />
        ) : null}
        {view === "Connect" ? (
          member ? (
            <Connect church={church} member={member} onNotice={setNotice} />
          ) : (
            <>
              <Gatherings church={church} member={null} onNotice={setNotice} />
              <Grow growth={church.growth} signedIn={false} onNotice={setNotice} />
              <SignIn error={authError} onGo={go} />
            </>
          )
        ) : null}
      </main>
      <nav className="member-tabs" aria-label="Member sections" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-label={tab.name}
            aria-selected={view === tab.id}
            onClick={() => go(tab.id)}
          >
            <TabIcon id={tab.id} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

async function shareOrCopy(data: { title: string; text: string; url: string }, onNotice: Notify) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
    onNotice("Copied. Paste it in a text to a friend.");
  } catch {
    onNotice("Sharing isn't available in this browser.");
  }
}

function formatEventTime(start: number, end: number) {
  const zone = { timeZone: "America/Chicago" } as const;
  const day = new Date(start).toLocaleDateString("en-US", {
    ...zone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = (at: number) =>
    new Date(at).toLocaleTimeString("en-US", { ...zone, hour: "numeric", minute: "2-digit" });
  return `${day}, ${time(start)}–${time(end)}`;
}

/** Posts to the member API, reports the result, and refreshes the page data. */
function useAct(onNotice: Notify) {
  const router = useRouter();
  return async function act(path: string, body?: Record<string, unknown>, success?: string) {
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
  };
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function InviteCard({ church, onNotice }: { church: ChurchView; onNotice: Notify }) {
  return (
    <article className="card invite-card">
      <h2>{church.invite.title}</h2>
      <p>{church.invite.body}</p>
      <p className="muted">Next gathering {church.service}.</p>
      <div className="cta-row">
        <button
          type="button"
          className="button"
          onClick={() =>
            void shareOrCopy(
              {
                title: church.invite.title,
                text: `${church.invite.title}! ${church.invite.body}`,
                url: church.invite.url,
              },
              onNotice,
            )
          }
        >
          Invite a friend
        </button>
        <a className="button secondary" href={church.invite.mapsUrl} target="_blank" rel="noreferrer">
          Directions
        </a>
      </div>
    </article>
  );
}

function DailyWord({
  church,
  signedIn,
  onNotice,
}: {
  church: ChurchView;
  signedIn: boolean;
  onNotice: Notify;
}) {
  const reading = church.daily.reading;
  const [saved, setSaved] = useState<number | null>(null);
  const stored = useSyncExternalStore(
    subscribeStorage,
    () => localStreak(reading.day).count,
    () => 0,
  );
  const streak = saved ?? (signedIn ? church.daily.streak : stored);
  async function markRead() {
    if (!signedIn) {
      const next = markLocalStreak(reading.day);
      setSaved(next);
      onNotice(`Day ${next}. Keep going.`);
      return;
    }
    const response = await fetch("/api/daily-word/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const data = (await response.json().catch(() => ({}))) as { streak?: number; error?: string };
    if (response.ok && typeof data.streak === "number") {
      setSaved(data.streak);
      onNotice(`Day ${data.streak}. Keep going.`);
    } else {
      onNotice(data.error || "That didn't save. Please try again.");
    }
  }
  return (
    <article className="card verse">
      <p className="muted">Daily Word · {reading.reference} (KJV)</p>
      <blockquote>{reading.text}</blockquote>
      <p>
        Read {reading.read}. {reading.prompt}
      </p>
      <div className="cta-row">
        <button type="button" className="button" onClick={() => void markRead()}>
          I read today&apos;s Word
        </button>
        {streak ? <span className="badge">{streak === 1 ? "1 day" : `${streak} days`} in a row</span> : null}
      </div>
    </article>
  );
}

const STREAK_KEY = "onehope.dailyWord";

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function localStreak(today: string): { lastDay: string; count: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY) ?? "null") as {
      lastDay?: unknown;
      count?: unknown;
    } | null;
    if (!raw || typeof raw.lastDay !== "string" || typeof raw.count !== "number")
      return { lastDay: "", count: 0 };
    const gap = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${raw.lastDay}T00:00:00Z`)) / 86_400_000;
    return gap === 0 || gap === 1 ? { lastDay: raw.lastDay, count: raw.count } : { lastDay: "", count: 0 };
  } catch {
    return { lastDay: "", count: 0 };
  }
}

function markLocalStreak(today: string): number {
  const previous = localStreak(today);
  const count = previous.lastDay === today ? previous.count : previous.count + 1;
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDay: today, count }));
  } catch {
    // Private browsing can refuse storage. The count still shows for this visit.
  }
  return count;
}

function Home({
  church,
  signedIn,
  onNotice,
  onGo,
  onWatch,
}: {
  church: ChurchView;
  signedIn: boolean;
  onNotice: Notify;
  onGo: (view: View) => void;
  onWatch: (id: string) => void;
}) {
  const featuredVideo = church.featured
    ? church.videos.find((video) => video.id === church.featured?.videoId)
    : undefined;
  const latest = featuredVideo ?? church.videos.find((video) => video.kind === "message");
  return (
    <>
      <section className="member-hero">
        <ChurchImage src={church.images.hero} alt="" />
        <div>
          <p>{church.greeting}</p>
          <h2>Sundays at 10:30 a.m.</h2>
          <p>{church.visit.arrival}</p>
        </div>
      </section>
      <div className="cta-row">
        <button type="button" className="button" onClick={() => onGo("Visit")}>
          Plan a Visit
        </button>
        <button type="button" className="button secondary" onClick={() => onGo("Jesus")}>
          Know Jesus
        </button>
      </div>
      {latest ? (
        <button type="button" className="card video-card featured" onClick={() => onWatch(latest.id)}>
          <svg width="0" height="0" aria-hidden="true" className="sermon-filter">
            <filter id="sermon-contrast" colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="linear" slope="3.2" intercept="-2" />
                <feFuncG type="linear" slope="3.2" intercept="-2" />
                <feFuncB type="linear" slope="3.2" intercept="-2" />
              </feComponentTransfer>
            </filter>
          </svg>
          {latest.thumbnail ? (
            <Image src={latest.thumbnail} alt="" width={640} height={360} className="sermon-art" />
          ) : null}
          <span className="muted">
            {church.featured ? "This Sunday" : `Latest message · ${formatDate(latest.published)}`}
          </span>
          <strong>{church.featured?.title || latest.title}</strong>
          {church.featured ? (
            <span>
              {church.featured.speaker}
              {church.featured.passage ? ` · ${church.featured.passage}` : ""}
            </span>
          ) : null}
        </button>
      ) : null}
      <article className="card">
        <h2>This Sunday</h2>
        <p>{church.service}</p>
        <p>{church.address}</p>
        <p>Lead pastors {church.pastors}.</p>
      </article>
      <InviteCard church={church} onNotice={onNotice} />
      <DailyWord church={church} signedIn={signedIn} onNotice={onNotice} />
      <FollowAlong links={church.social} />
      <Link className="card coffee-card" href="/coffee">
        <ChurchImage src={church.images.revival} alt="" />
        <strong>Revival Coffee</strong>
        <span>Menu, hours, and directions. The shop is in our building.</span>
        <span className="button">See menu</span>
      </Link>
      <button type="button" className="card photo-card" onClick={() => onGo("Jesus")}>
        <ChurchImage src={church.images.about} alt="" />
        <strong>Know Jesus</strong>
        <span>God loves you. See what the Bible says and take your next step.</span>
      </button>
      <button type="button" className="card photo-card" onClick={() => onGo("Visit")}>
        <ChurchImage src={church.images.about} alt="" />
        <strong>Plan a Visit</strong>
        <span>{church.visit.welcome} What to expect, kids, and directions.</span>
      </button>
      {church.announcements.map((item) => (
        <article className="card" key={item.id}>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </article>
      ))}
    </>
  );
}

function VideoTile({
  video,
  onSelect,
  onNotice,
}: {
  video: MemberVideo;
  onSelect: (id: string) => void;
  onNotice: Notify;
}) {
  return (
    <article className={`card video-card ${video.kind}`}>
      <button type="button" onClick={() => onSelect(video.id)}>
        {video.thumbnail ? <Image src={video.thumbnail} alt="" width={480} height={360} /> : null}
        <strong>{video.title}</strong>
        <span className="muted">{formatDate(video.published)}</span>
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() =>
          void shareOrCopy(
            { title: video.title, text: `Watch "${video.title}" from One Hope`, url: video.link },
            onNotice,
          )
        }
      >
        Share
      </button>
    </article>
  );
}

function Watch({
  church,
  selected,
  onSelect,
  onNotice,
}: {
  church: ChurchView;
  selected: string;
  onSelect: (id: string) => void;
  onNotice: Notify;
}) {
  const messages = church.videos.filter((video) => video.kind === "message");
  const shorts = church.videos.filter((video) => video.kind === "short");
  const current = church.videos.find((video) => video.id === selected) ?? messages[0] ?? church.videos[0];
  return (
    <>
      {current ? (
        <>
          <iframe
            className="player"
            title={current.title}
            src={`https://www.youtube.com/embed/${encodeURIComponent(current.id)}?playsinline=1&rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <h2>{current.title}</h2>
          <p className="muted">
            {formatDate(current.published)} ·{" "}
            <a
              href={`https://www.youtube.com/watch?v=${encodeURIComponent(current.id)}`}
              target="_blank"
              rel="noreferrer"
            >
              Play on YouTube
            </a>
          </p>
        </>
      ) : (
        <p>Sunday messages will appear here.</p>
      )}
      <h2>Messages</h2>
      <div className="video-grid">
        {messages.map((video) => (
          <VideoTile key={video.id} video={video} onSelect={onSelect} onNotice={onNotice} />
        ))}
      </div>
      {shorts.length > 0 ? (
        <>
          <h2>Shorts</h2>
          <p className="muted">Short clips to share with a friend.</p>
          <div className="video-grid">
            {shorts.map((video) => (
              <VideoTile key={video.id} video={video} onSelect={onSelect} onNotice={onNotice} />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

const DECISIONS: { kind: FollowUpKind; label: string; thanks: string }[] = [
  {
    kind: "salvation",
    label: "I said yes to Jesus",
    thanks:
      "This is the best decision you'll ever make. A pastor will reach out, and your 30-day journey starts below.",
  },
  {
    kind: "baptism",
    label: "I want to be baptized",
    thanks: "Wonderful. A pastor will reach out about baptism.",
  },
  { kind: "new", label: "I'm new", thanks: "Welcome to One Hope! We're glad you're here." },
  {
    kind: "growth_track",
    label: "Growth Track",
    thanks: "Great. We'll reach out about the next Growth Track.",
  },
];

function FollowUpForm({
  kind,
  label,
  signedIn,
  onDone,
}: {
  kind: FollowUpKind;
  label: string;
  signedIn: boolean;
  onDone: (message: string, ok: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(signedIn);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!signedIn && !name.trim()) {
      onDone("Please tell us your name.", false);
      return;
    }
    if ((email.trim() || phone.trim()) && !consent) {
      onDone("Check the box so we can contact you, or leave email and phone empty.", false);
      return;
    }
    setBusy(true);
    const body = signedIn
      ? { kind, consent }
      : { kind, name: name.trim(), email: email.trim(), phone: phone.trim(), consent };
    const response = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    onDone(response.ok ? "" : data.error || "That didn't go through. Please try again.", response.ok);
  }
  return (
    <form
      className="form card"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h3>{label}</h3>
      {signedIn ? null : (
        <>
          <label>
            Your name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={80}
              required
            />
          </label>
          <label>
            Email (optional)
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Phone (optional)
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
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> One
        Hope may contact me about this{signedIn ? " using my account email" : ""}.
      </label>
      <button className="button" type="submit" disabled={busy}>
        Send
      </button>
    </form>
  );
}

function KnowJesusView({
  church,
  signedIn,
  onNotice,
}: {
  church: ChurchView;
  signedIn: boolean;
  onNotice: Notify;
}) {
  const [open, setOpen] = useState<FollowUpKind | null>(null);
  const [journey, setJourney] = useState(false);
  return (
    <>
      <p>{church.gospel.intro}</p>
      {church.gospel.steps.map((step, index) => (
        <article className="card verse" key={step.reference}>
          <p className="muted">
            {index + 1}. {step.title}
          </p>
          <blockquote>{step.text}</blockquote>
          <p className="muted">{step.reference} (KJV)</p>
        </article>
      ))}
      {church.gospel.pastoralCopy === "pending" ? (
        <p className="muted">Salvation and baptism wording is pending pastor approval.</p>
      ) : null}
      <article className="card">
        <h2>A prayer you can pray</h2>
        <p>{church.gospel.prayer}</p>
      </article>
      <h2>Take your next step</h2>
      <div className="decisions">
        {DECISIONS.map((decision) => (
          <button
            key={decision.kind}
            type="button"
            className={decision.kind === "salvation" ? "button" : "button secondary"}
            aria-expanded={open === decision.kind}
            onClick={() => setOpen(open === decision.kind ? null : decision.kind)}
          >
            {decision.label}
          </button>
        ))}
      </div>
      {open ? (
        <FollowUpForm
          key={open}
          kind={open}
          label={DECISIONS.find((decision) => decision.kind === open)?.label ?? ""}
          signedIn={signedIn}
          onDone={(message, ok) => {
            if (!ok) {
              onNotice(message);
              return;
            }
            onNotice(DECISIONS.find((decision) => decision.kind === open)?.thanks ?? "Thank you.");
            if (open === "salvation") setJourney(true);
            setOpen(null);
          }}
        />
      ) : null}
      <article className="card">
        <h2>Water baptism</h2>
        <p>{church.gospel.baptism}</p>
        <blockquote>{church.gospel.baptismVerse.text}</blockquote>
        <p className="muted">{church.gospel.baptismVerse.reference} (KJV)</p>
      </article>
      <article className="card">
        <h2>Growth Track</h2>
        <p>{church.gospel.growthTrack}</p>
      </article>
      <section>
        <h2>Your first 30 days with Jesus</h2>
        {journey ? null : (
          <button type="button" className="text-button" onClick={() => setJourney(true)}>
            Show the 30-day journey
          </button>
        )}
        {journey
          ? (church.journeyMonth.length > 0 ? church.journeyMonth : church.journey).map((day) => (
              <article className="card verse" key={day.day}>
                <p className="muted">
                  Day {day.day} · {day.title}
                </p>
                <blockquote>{day.text}</blockquote>
                <p className="muted">{day.reference} (KJV)</p>
                <p>{day.prompt}</p>
              </article>
            ))
          : null}
      </section>
    </>
  );
}

function Give({ church, signedIn, onNotice }: { church: ChurchView; signedIn: boolean; onNotice: Notify }) {
  const giving = church.giving;
  return (
    <>
      <p>{giving.message}</p>
      <article className="card verse">
        <blockquote>{giving.verse.text}</blockquote>
        <p className="muted">{giving.verse.reference} (KJV)</p>
      </article>
      <article className="card">
        <h2>Online giving</h2>
        <p>{giving.online.note}</p>
        <a className="button" href={giving.online.url} target="_blank" rel="noreferrer">
          Give online
        </a>
      </article>
      <article className="card">
        <h2>Text to give</h2>
        <p>{giving.text.note}</p>
        <a className="button secondary" href={`sms:${giving.text.number}`}>
          Text {giving.text.number}
        </a>
      </article>
      {giving.seasonal ? (
        <article className="card">
          <h2>{giving.seasonal.title}</h2>
          <p>{giving.seasonal.note}</p>
          <a className="button secondary" href={giving.online.url} target="_blank" rel="noreferrer">
            Give to the Giving Tree
          </a>
        </article>
      ) : null}
      <article className="card">
        <h2>By mail</h2>
        <p>{giving.mail.note}</p>
        <p>{giving.mail.address}</p>
      </article>
      {church.givingOpen ? (
        <GiveInApp
          funds={church.funds}
          frequencies={church.frequencies}
          signedIn={signedIn}
          onNotice={onNotice}
        />
      ) : null}
    </>
  );
}

function PlanVisit({
  church,
  signedIn,
  onNotice,
}: {
  church: ChurchView;
  signedIn: boolean;
  onNotice: Notify;
}) {
  const [coming, setComing] = useState(false);
  const visit = church.visit;
  return (
    <>
      <section className="member-hero">
        <ChurchImage src={church.images.hero} alt="" />
        <div>
          <h2>{visit.welcome}</h2>
          <p>{church.service}</p>
        </div>
      </section>
      <article className="card">
        <h2>When</h2>
        <p>{visit.serviceTime}</p>
        <p>{visit.arrival}</p>
        <a className="button secondary" href={visit.calendarPath}>
          Add to calendar
        </a>
      </article>
      <article className="card">
        <h2>Where</h2>
        <p>{visit.address}</p>
        <p>{visit.directions}</p>
        <a className="button secondary" href={visit.mapsUrl} target="_blank" rel="noreferrer">
          Open in Maps
        </a>
      </article>
      <article className="card">
        <h2>Kids</h2>
        <p>{visit.kids}</p>
      </article>
      <FollowAlong links={church.social} />
      {coming ? (
        <FollowUpForm
          kind="visit"
          label="I'm coming"
          signedIn={signedIn}
          onDone={(message, ok) => {
            onNotice(ok ? "We can't wait to meet you! Look for the welcome team at the door." : message);
            if (ok) setComing(false);
          }}
        />
      ) : (
        <button type="button" className="button" onClick={() => setComing(true)}>
          I&apos;m coming
        </button>
      )}
      <InviteCard church={church} onNotice={onNotice} />
    </>
  );
}

function SignIn({ error, onGo }: { error: string; onGo: (view: View) => void }) {
  return (
    <>
      <p>
        Sign in to join groups, register for Sunday, send a prayer request, check in kids, and see the
        directory. Watch, Know Jesus, Give, and Plan a Visit are open to everyone.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <form className="form" action={signInMember}>
        <h2>Sign in</h2>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="button" type="submit">
          Sign in
        </button>
      </form>
      <form className="form" action={signUpMember}>
        <h2>Create an account</h2>
        <label>
          Name
          <input name="name" autoComplete="name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <button className="button" type="submit">
          Create account
        </button>
      </form>
      <button type="button" className="text-button" onClick={() => onGo("Visit")}>
        New here? Plan a Visit
      </button>
    </>
  );
}

/** Groups and events from Church Center. Guests browse; members also join and register. */
function Gatherings({
  church,
  member,
  onNotice,
}: {
  church: ChurchView;
  member: MemberView | null;
  onNotice: Notify;
}) {
  const act = useAct(onNotice);
  const categories = [...new Set(church.groups.map((group) => group.category ?? "Groups"))];
  return (
    <>
      <section>
        <h2>Events</h2>
        {church.events.map((event) => {
          const registered = member?.registeredEventIds.includes(event.id) ?? false;
          return (
            <article className="card" key={event.id}>
              <h3>{event.title}</h3>
              <p>{formatEventTime(event.start, event.end)}</p>
              <p className="muted">{event.detail}</p>
              {event.url ? (
                <a className="button" href={event.url} target="_blank" rel="noreferrer">
                  Register on Church Center
                </a>
              ) : member ? (
                <button
                  type="button"
                  className="button"
                  disabled={registered}
                  onClick={() => void act(`/api/events/${event.id}/register`, {}, "You're registered.")}
                >
                  {registered ? "Registered" : "Register"}
                </button>
              ) : null}
              <a href={`/api/events/${event.id}/ics`}>Add to calendar</a>
            </article>
          );
        })}
      </section>
      {categories.map((category) => (
        <section key={category}>
          <h2>{category}</h2>
          {church.groups
            .filter((group) => (group.category ?? "Groups") === category)
            .map((group) => (
              <article className="card" key={group.id}>
                <h3>{group.name}</h3>
                {group.schedule ? <p>{group.schedule}</p> : null}
                <p className="muted">{[group.area, group.summary].filter(Boolean).join(" · ")}</p>
                {group.leaders.length > 0 ? <p className="muted">Led by {group.leaders.join(", ")}</p> : null}
                {member && group.joinType === "open" ? (
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
                ) : null}
                {group.url ? (
                  <a href={group.url} target="_blank" rel="noreferrer">
                    {group.joinType === "request"
                      ? "Request to join on Church Center"
                      : "See it on Church Center"}
                  </a>
                ) : null}
              </article>
            ))}
        </section>
      ))}
    </>
  );
}

function MyFive({ onNotice }: { onNotice: Notify }) {
  const act = useAct(onNotice);
  const [names, setNames] = useState(["", "", "", "", ""]);
  return (
    <section>
      <h2>My 5</h2>
      <p>Up to five people you are praying for and inviting. Only you can see this list.</p>
      {names.map((name, index) => (
        <input
          key={index}
          value={name}
          aria-label={`Person ${index + 1}`}
          onChange={(event) => {
            const next = [...names];
            next[index] = event.target.value;
            setNames(next);
          }}
        />
      ))}
      <button
        type="button"
        className="button"
        onClick={() =>
          void act(
            "/api/my-five",
            { names: names.map((name) => name.trim()).filter(Boolean) },
            "Saved. Only you can see this.",
          )
        }
      >
        Save my list
      </button>
    </section>
  );
}

function Connect({ church, member, onNotice }: { church: ChurchView; member: MemberView; onNotice: Notify }) {
  const act = useAct(onNotice);
  const [serve, setServe] = useState("");
  const [prayer, setPrayer] = useState("");
  const [contact, setContact] = useState(false);
  const [note, setNote] = useState("");
  const joined = church.groups.filter((group) => group.joined);
  return (
    <>
      <FollowAlong links={church.social} />
      <MyFive onNotice={onNotice} />
      <section>
        <h2>Next steps</h2>
        {member.pathway.map((step) => (
          <article className="card step" key={step.id}>
            <h3>{step.title}</h3>
            <p>{stepLabel(step.status)}</p>
          </article>
        ))}
      </section>
      <section>
        <h2>Serving</h2>
        {member.serving.length === 0 ? (
          <p>No serving assignment yet. Ask about a team at Growth Track.</p>
        ) : null}
        {member.serving.map((item) => (
          <article className="card" key={item.id}>
            <h3>{item.position}</h3>
            <p>{item.status === "pending" ? "Waiting for your answer" : item.status}</p>
            {item.status === "pending" ? (
              <div className="template-row">
                <form action={respondServingAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="accept" value="yes" />
                  <button className="button" type="submit">
                    Yes, I will serve
                  </button>
                </form>
                <form action={respondServingAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="accept" value="no" />
                  <button className="button secondary" type="submit">
                    I cannot this time
                  </button>
                </form>
              </div>
            ) : null}
          </article>
        ))}
      </section>
      <Gatherings church={church} member={member} onNotice={onNotice} />
      <Grow growth={church.growth} signedIn onNotice={onNotice} />
      <section>
        <h2>Group note</h2>
        {joined.length === 0 ? <p>Join a group before sending a note.</p> : null}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={joined.length === 0}
        />
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
        <h2>Prayer request</h2>
        <label>
          How can we serve you?
          <input value={serve} onChange={(event) => setServe(event.target.value)} maxLength={300} />
        </label>
        <fieldset>
          <legend>Please check a box below</legend>
          <label>
            <input type="radio" name="prayer-contact" checked={!contact} onChange={() => setContact(false)} />
            Just pray for me
          </label>
          <label>
            <input type="radio" name="prayer-contact" checked={contact} onChange={() => setContact(true)} />
            Please contact me
          </label>
        </fieldset>
        <label>
          Please describe your prayer need
          <textarea value={prayer} onChange={(event) => setPrayer(event.target.value)} maxLength={1000} />
        </label>
        <button
          type="button"
          className="button"
          onClick={() => {
            const body = prayer.trim();
            if (!serve.trim() || !body) {
              onNotice("Tell us how we can serve you and describe your prayer need.");
              return;
            }
            void act(
              "/api/prayers",
              { serve: serve.trim(), contact, body, visibility: "public" },
              "Your prayer request was sent to the pastors.",
            );
            setServe("");
            setPrayer("");
            setContact(false);
          }}
        >
          Send prayer request
        </button>
        {member.prayers.map((item) => (
          <article className="card" key={item.id}>
            {item.mine && item.serve ? <h3>{item.serve}</h3> : null}
            <p>{item.body}</p>
            {item.mine && item.contactRequested ? <p className="muted">A pastor will contact you.</p> : null}
            {item.mine && !item.approved ? <p>Waiting for pastor approval</p> : null}
          </article>
        ))}
      </section>
      <KidsCheckIn kids={member.kids} onNotice={onNotice} />
      <Account member={member} onNotice={onNotice} />
    </>
  );
}

function stepLabel(status: string) {
  switch (status) {
    case "done":
      return "Done";
    case "requested":
      return "Requested. A pastor will reach out.";
    case "in-progress":
      return "In progress";
    default:
      return "Not started";
  }
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

function Account({ member, onNotice }: { member: MemberView; onNotice: Notify }) {
  const router = useRouter();
  const [emailPublic, setEmailPublic] = useState(member.emailPublic);
  const [phonePublic, setPhonePublic] = useState(member.phonePublic);
  const [listed, setListed] = useState(member.listedInDirectory);
  return (
    <>
      <article className="card">
        <h2>Account</h2>
        <p>{member.accountName}</p>
        <p>{member.accountEmail}</p>
        <form action={signOutMember}>
          <button className="button" type="submit">
            Sign out
          </button>
        </form>
        <DeleteAccount />
      </article>
      <section>
        <h2>Directory</h2>
        <label>
          <input
            type="checkbox"
            checked={emailPublic}
            onChange={(event) => setEmailPublic(event.target.checked)}
          />{" "}
          Show my email
        </label>
        <label>
          <input
            type="checkbox"
            checked={phonePublic}
            onChange={(event) => setPhonePublic(event.target.checked)}
          />{" "}
          Show my phone
        </label>
        <label>
          <input type="checkbox" checked={listed} onChange={(event) => setListed(event.target.checked)} />{" "}
          List me in the directory
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
              onNotice(
                response.ok
                  ? "Your privacy settings were saved."
                  : data.error || "Those settings were not saved.",
              );
              if (response.ok) router.refresh();
            })();
          }}
        >
          Save privacy
        </button>
        {member.directory.length === 0 ? <p>People appear here when they choose to be listed.</p> : null}
        {member.directory.map((person) => (
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
