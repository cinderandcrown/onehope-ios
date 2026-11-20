import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { MemberTabs, type ChurchView, type MemberView } from "@/components/member-tabs";
import { GIVING_FREQUENCIES, greeting, loadConfig, loadSermons, withStore } from "@onehope/server";

/** Hide labeled sample rows when the church has real ones. A demo with only sample rows still works. */
function preferReal<T extends { sample?: boolean }>(rows: T[]): T[] {
  const real = rows.filter((row) => !row.sample);
  return real.length > 0 ? real : rows;
}

export const dynamic = "force-dynamic";

export default async function MemberPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const token = jar.get("onehope_member")?.value ?? null;
  const config = loadConfig(process.env);
  const videos = await loadSermons(fetch, config.youtubeChannelId);
  let loaded: { church: ChurchView; member: MemberView | null };
  try {
    loaded = await withStore((store) => {
      const home = store.publicHome();
      const knowJesus = store.knowJesus();
      const church: ChurchView = {
        churchName: home.church.name,
        address: home.church.address,
        pastors: home.church.leadPastors.join(" and "),
        service: new Intl.DateTimeFormat("en-US", {
          timeZone: home.church.timeZone,
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(home.countdown.service)),
        announcements: home.announcements.filter((item) => !item.sample && !item.title.startsWith("Sample")),
        events: preferReal(home.events).map((event) => ({
          id: event.id,
          title: event.title,
          detail: event.location,
          start: event.start,
          end: event.end,
          url: event.url,
        })),
        groups: preferReal(store.listGroups(token)).map((group) => ({
          id: group.id,
          name: group.name,
          summary: group.summary,
          category: group.category,
          schedule: group.schedule,
          area: group.area,
          leaders: group.leaders,
          joinType: group.joinType,
          url: group.url,
          joined: group.joined,
        })),
        videos: videos.map((video) => ({
          id: video.id,
          title: video.title,
          thumbnail: video.thumbnail,
          published: video.published,
          link: video.link,
          kind: video.kind,
        })),
        visit: home.visit,
        giving: home.giving,
        invite: home.invite,
        gospel: knowJesus.gospel,
        journey: knowJesus.journey,
        daily: store.dailyWord(token),
        givingOpen: store.givingAvailability().open,
        funds: store.funds(),
        frequencies: GIVING_FREQUENCIES,
        growth: store.growth(),
        images: home.images,
        social: store.socialLinks(),
        greeting: greeting(store.clock(), null),
        journeyMonth: knowJesus.journeyMonth,
      };
      if (!token) return { church, member: null };
      const me = store.me(token);
      church.greeting = greeting(store.clock(), me.displayName);
      const member: MemberView = {
        registeredEventIds: store
          .listEvents(token)
          .filter((event) => event.registered)
          .map((event) => event.id),
        prayers: store
          .listPrayers(token)
          .filter((prayer) => prayer.body.length > 0 || prayer.mine)
          .map((prayer) => ({
            id: prayer.id,
            serve: prayer.serve,
            body: prayer.body,
            contactRequested: prayer.contactRequested,
            approved: prayer.approved,
            mine: prayer.mine,
          })),
        kids: store.myKids(token).map((child) => ({
          id: child.id,
          displayName: child.displayName,
          classroom: child.classroom,
          checkedIn: child.checkedIn,
        })),
        pathway: store.myPathway(token).steps,
        serving: store
          .serving(token)
          .map((item) => ({ id: item.id, position: item.position, status: item.status })),
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
      };
      return { church, member };
    });
  } catch {
    redirect("/member/start");
  }
  const authError =
    params.deleted === "1"
      ? "Your account was deleted."
      : params.error === "signup"
        ? "We couldn't create that account. Check the name, email, and password."
        : params.error === "password" && !loaded.member
          ? "That email and password don't match."
          : "";
  const memberPasswordError = params.error === "password" && loaded.member !== null;
  return (
    <MemberTabs
      key={`${loaded.member ? "member" : "guest"}:${params.error ?? ""}:${params.deleted ?? ""}`}
      church={loaded.church}
      member={loaded.member}
      authError={authError}
      initialTab={authError || memberPasswordError ? "Connect" : "Home"}
      initialNotice={memberPasswordError ? "That password didn't match." : ""}
    />
  );
}
