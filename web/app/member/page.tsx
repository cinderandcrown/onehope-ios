import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { MemberTabs, type MemberDemo } from "@/components/member-tabs";
import { signInMember, signOutMember, signUpMember } from "@/app/member/actions";
import { loadConfig, loadSermons, withStore } from "@onehope/server";

export const dynamic = "force-dynamic";

export default async function MemberPage() {
  const jar = await cookies();
  const token = jar.get("onehope_member")?.value;
  if (!token) return <MemberAuth />;
  const config = loadConfig(process.env);
  const videos = await loadSermons(fetch, config.youtubeChannelId);
  const latest = videos[0];
  let demo: MemberDemo;
  try {
    demo = await withStore((store) => {
      const home = store.publicHome();
      const me = store.me(token);
      let gifts: MemberDemo["gifts"] = [];
      let needsStepUp = false;
      try {
        gifts = store.myGifts(token).map((gift) => ({
          id: gift.id,
          fundName: gift.fundName,
          amount: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
            gift.amountCents / 100,
          ),
          charged: gift.charged,
          sample: gift.sample,
        }));
      } catch {
        needsStepUp = true;
      }
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
        events: home.events.map((event) => ({
          id: event.id,
          title: event.title,
          detail: event.location,
          sample: event.sample,
        })),
        sermonTitle: latest?.title ?? home.sampleSermon.title,
        sermonSample: !latest,
        sermonNote: latest
          ? "From the public YouTube channel."
          : "The YouTube feed did not return a video. The title above is a sample.",
        groups: store.listGroups(token).map((group) => ({
          id: group.id,
          name: group.name,
          summary: group.summary,
          sample: group.sample,
          joined: group.joined,
        })),
        prayers: store
          .listPrayers(token)
          .filter((prayer) => prayer.body.length > 0)
          .map((prayer) => ({ id: prayer.id, body: prayer.body, sample: prayer.sample })),
        kids: store.myKids(token),
        pathway: store.myPathway(token).steps,
        serving: store.serving(token).map((item) => ({
          id: item.id,
          position: item.position,
          status: item.status,
          sample: item.sample,
        })),
        directory: store.directory(token).map((person) => ({
          id: person.id,
          displayName: person.displayName,
          email: person.email,
          phone: person.phone,
        })),
        accountName: me.displayName,
        accountEmail: me.email,
        gifts,
        needsStepUp,
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
      <MemberTabs demo={demo} />
    </>
  );
}

function MemberAuth() {
  return (
    <main className="member">
      <h1>One Hope</h1>
      <p>Sundays at 10:30 a.m. Come early for donuts and coffee.</p>
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
