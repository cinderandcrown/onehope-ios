import {
  EVENT_TEMPLATES,
  SERVE_TEMPLATES,
  chicagoInputValue,
  formatChicago,
  type ChurchStore,
} from "@onehope/server";

import {
  cancelEventAction,
  cancelServeAction,
  postEventAction,
  postServeAction,
  updateEventAction,
  updateServeAction,
} from "@/app/staff-actions";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function noticeFor(query: Record<string, string | string[] | undefined>) {
  if (one(query, "saved")) return "Saved. People see the change the next time they open the app.";
  if (one(query, "error") === "time") return "Add a start and an end. The end has to be later than the start.";
  if (one(query, "error") === "capacity") return "Capacity is a whole number, or leave it blank for no limit.";
  if (one(query, "error")) return "That could not be saved. Check the name, place, and times.";
  return "";
}

export function EventsDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const events = store.staffEvents(token);
  const serveDays = store.staffServeDays(token);
  const notice = noticeFor(query);
  return (
    <section>
      <h1>Events</h1>
      <p className="help">
        How do I post a gathering? Pick a ready-made one, or type the name, place, and the real date and time,
        then tap Add. Times are Central. Nothing is scheduled a week out unless you choose that date. Cancel
        takes it off the app. People are not texted.
      </p>
      {notice ? <p className="notice">{notice}</p> : null}
      <div className="template-row">
        {EVENT_TEMPLATES.map((template) => (
          <form key={template.id} action={postEventAction}>
            <input type="hidden" name="template" value={template.id} />
            <button className="button" type="submit">
              Post {template.title}
            </button>
          </form>
        ))}
      </div>
      <form className="form" action={postEventAction}>
        <label>
          Name
          <input name="title" required maxLength={80} placeholder="Event name" />
        </label>
        <label>
          Place
          <input name="location" required maxLength={160} placeholder="Where people should go" />
        </label>
        <label>
          What to expect
          <textarea name="description" maxLength={1000} placeholder="Optional. A sentence is enough." />
        </label>
        <label>
          Starts (Central)
          <input name="start" type="datetime-local" required />
        </label>
        <label>
          Ends (Central)
          <input name="end" type="datetime-local" required />
        </label>
        <label>
          Capacity (optional)
          <input name="capacity" inputMode="numeric" placeholder="Leave blank if anyone can come" />
        </label>
        <button className="button" type="submit">
          Add event
        </button>
      </form>
      {events.length === 0 ? (
        <p>No gatherings are on the calendar. Add one and it shows in the app.</p>
      ) : (
        events.map((event) => (
          <article className="panel" key={event.id}>
            <p className="badge">{event.cancelled ? "Canceled" : "On the calendar"}</p>
            <form className="form" action={updateEventAction}>
              <input type="hidden" name="id" value={event.id} />
              <label>
                Name
                <input name="title" required maxLength={80} defaultValue={event.title} />
              </label>
              <label>
                Place
                <input name="location" required maxLength={160} defaultValue={event.location} />
              </label>
              <label>
                What to expect
                <textarea name="description" maxLength={1000} defaultValue={event.description} />
              </label>
              <label>
                Starts
                <input name="start" type="datetime-local" required defaultValue={chicagoInputValue(event.start)} />
              </label>
              <label>
                Ends
                <input name="end" type="datetime-local" required defaultValue={chicagoInputValue(event.end)} />
              </label>
              <label>
                Capacity
                <input
                  name="capacity"
                  inputMode="numeric"
                  defaultValue={event.capacity === null ? "" : String(event.capacity)}
                  placeholder="Open"
                />
              </label>
              <p className="muted">
                {formatChicago(event.start)} – {formatChicago(event.end)}
                {event.capacity === null ? " · Open" : ` · ${event.capacity} spots`}
              </p>
              {event.url ? (
                <p>
                  <a href={event.url}>Signup page</a>
                </p>
              ) : null}
              <button className="button" type="submit">
                Save event
              </button>
            </form>
            <form action={cancelEventAction}>
              <input type="hidden" name="id" value={event.id} />
              <input type="hidden" name="cancelled" value={event.cancelled ? "no" : "yes"} />
              <button className="button secondary" type="submit">
                {event.cancelled ? "Put back on the calendar" : "Cancel event"}
              </button>
            </form>
          </article>
        ))
      )}
      <h2>Serve days</h2>
      <p className="help">
        How do I ask for help in the neighborhood? Post a serve day with a real date. People can sign up in
        the app. Leave this blank until you have a real one.
      </p>
      <div className="template-row">
        {SERVE_TEMPLATES.map((template) => (
          <form key={template.id} action={postServeAction}>
            <input type="hidden" name="template" value={template.id} />
            <button className="button" type="submit">
              Post {template.title}
            </button>
          </form>
        ))}
      </div>
      <form className="form" action={postServeAction}>
        <label>
          Name
          <input name="title" required maxLength={120} placeholder="Serve day name" />
        </label>
        <label>
          Place
          <input name="location" required maxLength={200} placeholder="Where to meet" />
        </label>
        <label>
          What people will do
          <textarea name="detail" maxLength={1000} placeholder="Optional" />
        </label>
        <label>
          Starts (Central)
          <input name="start" type="datetime-local" required />
        </label>
        <label>
          Ends (Central)
          <input name="end" type="datetime-local" required />
        </label>
        <button className="button" type="submit">
          Post serve day
        </button>
      </form>
      {serveDays.length === 0 ? (
        <p>No serve days yet. Post one when you have a date, or leave this empty.</p>
      ) : (
        serveDays.map((day) => (
          <article className="panel" key={day.id}>
            <p className="badge">{day.cancelled ? "Canceled" : `${day.signedUp} signed up`}</p>
            <form className="form" action={updateServeAction}>
              <input type="hidden" name="id" value={day.id} />
              <label>
                Name
                <input name="title" required maxLength={120} defaultValue={day.title} />
              </label>
              <label>
                Place
                <input name="location" required maxLength={200} defaultValue={day.location} />
              </label>
              <label>
                What people will do
                <textarea name="detail" maxLength={1000} defaultValue={day.detail} />
              </label>
              <label>
                Starts
                <input name="start" type="datetime-local" required defaultValue={chicagoInputValue(day.start)} />
              </label>
              <label>
                Ends
                <input name="end" type="datetime-local" required defaultValue={chicagoInputValue(day.end)} />
              </label>
              <p className="muted">{formatChicago(day.start)}</p>
              <button className="button" type="submit">
                Save serve day
              </button>
            </form>
            <form action={cancelServeAction}>
              <input type="hidden" name="id" value={day.id} />
              <input type="hidden" name="cancelled" value={day.cancelled ? "no" : "yes"} />
              <button className="button secondary" type="submit">
                {day.cancelled ? "Open signup again" : "Cancel serve day"}
              </button>
            </form>
          </article>
        ))
      )}
    </section>
  );
}
