import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { MemberTabs, type MemberDemo } from "@/components/member-tabs";
import { signInMember, signOutMember, signUpMember } from "@/app/member/actions";
import { loadConfig, loadSermons, withStore } from "@onehope/server";

export const dynamic = "force-dynamic";

export default async function MemberPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const token = jar.get("onehope_member")?.value;
  if (!token) return <MemberAuth error={params.deleted === "1" ? "deleted" : params.error} />;
  const config = loadConfig(process.env);
  const videos = await loadSermons(fetch, config.youtubeChannelId);
  let demo: MemberDemo;
  try {
    demo = await withStore((store) => {
      const home = store.publicHome();
      const me = store.me(token);
      return {
        churchName: home.church.name,
        address: home.church.address,
        pastors: home.church.leadPastors.join(" and "),
        service: new Intl.DateTimeFormat("en-US", {
          timeZone: home.church.timeZone,
          weekday: "long",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(home.countdown.service)),
        announcements: home.announcements,
        events: store.listEvents(token).map((event) => ({
          id: event.id,
          title: event.title,
          detail: event.location,
          start: event.start,
          end: event.end,
          registered: event.registered,
        })),
        videos: videos.map((video) => ({ id: video.id, title: video.title, thumbnail: video.thumbnail })),
        groups: store.listGroups(token).map((group) => ({
          id: group.id,
          name: group.name,
          summary: group.summary,
          joined: group.joined,
        })),
        prayers: store
          .listPrayers(token)
          .filter((prayer) => prayer.body.length > 0 || prayer.mine)
          .map((prayer) => ({
            id: prayer.id,
            body: prayer.body,
            approved: prayer.approved,
            mine: prayer.mine,
          })),
        kids: store.myKids(token).map((child) => ({
          id: child.id,
          displayName: child.displayName,
          classroom: child.classroom,
        })),
        pathway: store.myPathway(token).steps,
        serving: store.serving(token).map((item) => ({
          id: item.id,
          position: item.position,
          status: item.status,
        })),
        directory: store.directory(token).map((person) => ({
          id: person.id,
          displayName: person.displayName,
          email: person.email,
          phone: person.phone,
        })),
        accountName: me.displayName,
        accountEmail: me.email,
        emailPublic: me.emailPublic,
        phonePublic: me.phonePublic,
        listedInDirectory: me.listedInDirectory,
        givingOpen: store.givingAvailability().open,
      } satisfies MemberDemo;
    });
  } catch {
    redirect("/member/start");
  }
  return (
    <>
      <form action={signOutMember}>
        <button className="button" type="submit">
          Sign out
        </button>
      </form>
      <MemberTabs
        demo={demo}
        initialTab={params.error === "password" ? "More" : "Home"}
        initialNotice={params.error === "password" ? "That password didn't match." : ""}
      />
    </>
  );
}

function MemberAuth({ error }: { error?: string }) {
  const message =
    error === "password"
      ? "That email and password don't match."
      : error === "deleted"
        ? "Your account was deleted."
        : error
          ? "We couldn't create that account. Check the name, email, and password."
          : "";
  return (
    <main className="member">
      <h1>One Hope</h1>
      <p>Sundays at 10:30 a.m. Come early for donuts and coffee.</p>
      {message ? <p className="error">{message}</p> : null}
      <form className="form" action={signInMember}>
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
    </main>
  );
}
