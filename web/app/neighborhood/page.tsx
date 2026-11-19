import { neighborhoodPrayerAction } from "@/app/actions";
import { withStore } from "@onehope/server";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function NeighborhoodPage() {
  const board = await withStore((store) => store.community(null));
  return (
    <main className="public-page">
      <section className="public-hero">
        <Image src="/photos/community1.jpg" alt="One Hope community" width={1400} height={816} />
        <div>
          <p>Richardson</p>
          <h1>Prayer for the neighborhood</h1>
        </div>
      </section>
      <article className="card">
        <p>
          Tell us what to pray. A pastor reads it before it appears on the prayer wall. We do not contact you
          from this form.
        </p>
        <form className="form" action={neighborhoodPrayerAction}>
          <label>
            What should we pray?
            <textarea name="body" required maxLength={1000} />
          </label>
          <button className="button" type="submit">
            Send to the pastors
          </button>
        </form>
      </article>
      <h2>Serve the neighborhood</h2>
      {board.outreach.length === 0 ? (
        <p>Nothing is posted yet. When the church adds a serve day, it will show up here.</p>
      ) : (
        board.outreach.map((item) => (
          <article className="card" key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <p>{item.location}</p>
          </article>
        ))
      )}
    </main>
  );
}
