import {
  ANNOUNCEMENT_TEMPLATES,
  chicagoInputValue,
  formatChicago,
  type ChurchStore,
} from "@onehope/server";

import {
  archiveAnnouncementAction,
  postAnnouncementAction,
  updateAnnouncementAction,
} from "@/app/staff-actions";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function when(ms: number | null) {
  if (ms === null) return "Right away";
  return formatChicago(ms);
}

export function AnnouncementsDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const cards = store.staffAnnouncements(token);
  const live = cards.filter((card) => card.live && !card.sample);
  const notice = one(query, "saved")
    ? "Saved. Home updates the next time someone opens the app."
    : one(query, "error") === "time"
      ? "This card ends before it starts. Put the end after the start."
      : one(query, "error")
        ? "That card could not be saved. Check the words and try again."
        : "";
  return (
    <section>
      <h1>Home cards</h1>
      <p className="help">
        How do I put something on the app Home screen? Tap a ready-made card, or write your own and tap Post.
        Times are Central time. Leave the times blank to show the card right away. Archive takes it off Home.
        Nothing is texted or emailed from here.
      </p>
      {notice ? <p className="notice">{notice}</p> : null}
      <div className="template-row">
        {ANNOUNCEMENT_TEMPLATES.map((template) => (
          <form key={template.id} action={postAnnouncementAction}>
            <input type="hidden" name="template" value={template.id} />
            <button className="button" type="submit">
              Post “{template.title}”
            </button>
          </form>
        ))}
      </div>
      <article className="panel">
        <h2>Write your own</h2>
        <form className="form" action={postAnnouncementAction}>
          <label>
            Title
            <input name="title" required maxLength={80} placeholder="What should the card say?" />
          </label>
          <label>
            Note
            <textarea name="body" required maxLength={500} placeholder="A sentence or two is enough." />
          </label>
          <label>
            Show starting (Central, optional)
            <input name="startsAt" type="datetime-local" />
          </label>
          <label>
            Hide after (Central, optional)
            <input name="endsAt" type="datetime-local" />
          </label>
          <button className="button" type="submit">
            Post on Home
          </button>
        </form>
      </article>
      <article className="panel">
        <h2>Preview</h2>
        <p className="help">This is what people see on Home right now.</p>
        {live.length === 0 ? (
          <p>Nothing is on Home right now. Post a card and it shows up for everyone.</p>
        ) : (
          <div className="phone-preview">
            {live.map((card) => (
              <article className="card" key={card.id}>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        )}
      </article>
      <h2>All cards</h2>
      {cards.length === 0 ? (
        <p>No cards yet. Post one above and it will be waiting here to edit.</p>
      ) : (
        cards.map((card) => (
          <article className="panel" key={card.id}>
            <p className="badge">{card.archived ? "Archived" : card.live ? "On Home" : "Scheduled"}</p>
            <form className="form" action={updateAnnouncementAction}>
              <input type="hidden" name="id" value={card.id} />
              <label>
                Title
                <input name="title" required maxLength={80} defaultValue={card.title} />
              </label>
              <label>
                Note
                <textarea name="body" required maxLength={500} defaultValue={card.body} />
              </label>
              <label>
                Show starting
                <input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={card.startsAt === null ? "" : chicagoInputValue(card.startsAt)}
                />
              </label>
              <label>
                Hide after
                <input
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={card.endsAt === null ? "" : chicagoInputValue(card.endsAt)}
                />
              </label>
              <p className="muted">
                {when(card.startsAt)} → {when(card.endsAt)}
              </p>
              <button className="button" type="submit">
                Save changes
              </button>
            </form>
            <form action={archiveAnnouncementAction}>
              <input type="hidden" name="id" value={card.id} />
              <input type="hidden" name="archived" value={card.archived ? "no" : "yes"} />
              <button className="button secondary" type="submit">
                {card.archived ? "Put back on Home" : "Archive"}
              </button>
            </form>
          </article>
        ))
      )}
    </section>
  );
}
