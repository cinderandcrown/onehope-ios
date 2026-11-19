import { FollowAlong } from "@/components/follow-along";
import { withStore } from "@onehope/server";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ note?: string }> }) {
  const note = ((await searchParams).note ?? "").trim().slice(0, 280);
  const page = await withStore((store) => {
    const home = store.publicHome();
    return { home, social: store.socialLinks() };
  });
  return (
    <main className="public-page">
      <section className="public-hero">
        <Image src="/photos/hero.jpg" alt="People gathered at One Hope" width={1400} height={816} />
        <div>
          <p>One Hope Church</p>
          <h1>Come sit with us</h1>
        </div>
      </section>
      {note ? (
        <article className="card">
          <h2>A note for you</h2>
          <p>{note}</p>
        </article>
      ) : null}
      <article className="card">
        <h2>{page.home.visit.serviceTime}</h2>
        <p>{page.home.visit.arrival}</p>
        <p>{page.home.visit.address}</p>
        <p>{page.home.visit.directions}</p>
        <p>{page.home.visit.kids}</p>
        <p>
          <a className="button" href={page.home.visit.mapsUrl}>
            Directions
          </a>
        </p>
      </article>
      <FollowAlong links={page.social} />
      <p className="muted">
        <a href="https://www.weareonehope.com/plan-your-visit">More on weareonehope.com</a>
      </p>
    </main>
  );
}
