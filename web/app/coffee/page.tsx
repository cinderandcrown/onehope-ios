import { withStore } from "@onehope/server";
import { ChurchImage } from "@/components/church-image";

export const dynamic = "force-dynamic";

function money(cents: number | null) {
  if (cents === null) return "Ask your barista";
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function CoffeePage() {
  const loaded = await withStore((store) => ({ guide: store.coffeePublic(), images: store.churchImages() }));
  const coffee = loaded.guide;
  return (
    <main className="public-page">
      <section className="public-hero">
        <ChurchImage src={loaded.images.revival} alt="" />
        <div>
          <p>{coffee.shop.name}</p>
          <h1>{coffee.shop.tagline}</h1>
        </div>
      </section>
      <article className="card">
        <p>{coffee.shop.about}</p>
        <p>{coffee.shop.address}</p>
        <p>
          <a className="button" href={coffee.shop.mapsUrl}>
            Directions
          </a>{" "}
          <a className="button secondary" href={`mailto:${coffee.shop.email}`}>
            Email the shop
          </a>
        </p>
        <p className="muted">No public phone number is listed on myrevivalcoffee.com.</p>
        <p>
          <strong>{coffee.ordering.message}</strong>
        </p>
      </article>
      <article className="card">
        <h2>Hours</h2>
        <ul>
          {coffee.shop.hours.map((row) => (
            <li key={row.day}>
              {row.day}: {row.hours}
            </li>
          ))}
        </ul>
      </article>
      {coffee.menu.map((section) => (
        <section key={section.name}>
          <h2>{section.name}</h2>
          {section.items.map((item) => (
            <article className="card" key={item.id}>
              <h3>
                {item.name} · {money(item.priceCents)}
              </h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </section>
      ))}
      <article className="card">
        <h2>{coffee.shop.eventsTitle}</h2>
        <p>{coffee.shop.eventsBody}</p>
        <p>{coffee.shop.catering}</p>
      </article>
    </main>
  );
}
