import { formatChicago, type ChurchStore } from "@onehope/server";

/** What a member sees on Home this week, so staff can check it before Sunday. */
export function WeekPreview({ store }: { store: ChurchStore }) {
  const home = store.publicHome();
  const weekEnd = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const events = home.events.filter((event) => event.start <= weekEnd);
  const cards = home.announcements.filter((item) => !item.sample && !item.title.startsWith("Sample"));
  return (
    <article className="panel">
      <h2>This week on Home</h2>
      <p className="help">
        This is the member Home screen for the next seven days. If something is wrong, fix it on
        Communications, Events, or Media. People are not texted from here.
      </p>
      <div className="phone-preview">
        <article className="card">
          <h3>Sunday at 10:30</h3>
          <p>{formatChicago(Date.parse(home.countdown.service))}</p>
          <p className="muted">{home.church.address}</p>
        </article>
        {home.sampleSermon.title ? (
          <article className="card">
            <h3>{home.sampleSermon.title}</h3>
            <p className="muted">
              {home.sampleSermon.speaker}
              {home.sampleSermon.passage ? ` · ${home.sampleSermon.passage}` : ""}
            </p>
          </article>
        ) : (
          <article className="card">
            <h3>No message featured</h3>
            <p>Open Media and tap Feature on Home.</p>
          </article>
        )}
        {cards.length === 0 ? (
          <article className="card">
            <h3>No home cards</h3>
            <p>Post one under Communications.</p>
          </article>
        ) : (
          cards.map((card) => (
            <article className="card" key={card.id}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))
        )}
        {events.length === 0 ? (
          <article className="card">
            <h3>Nothing else this week</h3>
            <p>Add a gathering under Events when you have a date.</p>
          </article>
        ) : (
          events.map((event) => (
            <article className="card" key={event.id}>
              <h3>{event.title}</h3>
              <p>
                {formatChicago(event.start)} · {event.location}
              </p>
            </article>
          ))
        )}
      </div>
    </article>
  );
}
