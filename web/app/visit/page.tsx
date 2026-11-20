import { FollowAlong } from "@/components/follow-along";
import { withStore } from "@onehope/server";
import { ChurchImage } from "@/components/church-image";

export const dynamic = "force-dynamic";

export default async function VisitPage() {
  const page = await withStore((store) => {
    const home = store.publicHome();
    return { visit: home.visit, social: store.socialLinks(), address: home.church.address, images: home.images };
  });
  return (
    <main className="public-page">
      <section className="public-hero">
        <ChurchImage src={page.images.about} alt="" />
        <div>
          <p>Plan a visit</p>
          <h1>{page.visit.welcome}</h1>
        </div>
      </section>
      <article className="card">
        <h2>{page.visit.serviceTime}</h2>
        <p>{page.visit.arrival}</p>
        <p>{page.address}</p>
        <p>{page.visit.directions}</p>
        <p>{page.visit.kids}</p>
        <p>
          <a className="button" href={page.visit.mapsUrl}>
            Directions
          </a>
        </p>
      </article>
      <FollowAlong links={page.social} />
    </main>
  );
}
