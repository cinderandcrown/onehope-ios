import { PUSH_TEMPLATES, type ChurchStore } from "@onehope/server";

import { savePush } from "@/app/actions";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const SEGMENTS = [
  ["members", "Everyone with the app"],
  ["volunteers", "Volunteers"],
  ["parents", "Parents"],
] as const;

function segmentLabel(id: string) {
  return SEGMENTS.find((item) => item[0] === id)?.[1] ?? id;
}

export function PushDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  let desk: ReturnType<ChurchStore["pushDesk"]>;
  try {
    desk = store.pushDesk(token);
  } catch {
    return (
      <section>
        <h1>Push</h1>
        <p>Writing a notification is for pastors.</p>
      </section>
    );
  }
  const confirming = one(query, "confirm") === "1";
  const saved = one(query, "saved");
  const sent = one(query, "sent") === "1";
  const drafts = store.ministry(token).communications;
  return (
    <section>
      <h1>Push</h1>
      <p className="help">
        {desk.live
          ? "Apple push is on. You will confirm who receives it before anything is sent."
          : "Nothing was sent. Apple push is not turned on for this church, so this screen only saves a draft. Phones will not buzz."}
      </p>
      {saved ? (
        <p className="notice">
          {sent ? "Sent." : "Saved as a draft. Nothing was sent."}
        </p>
      ) : null}
      {one(query, "error") ? <p className="notice">Add a title and a short note, then try again.</p> : null}
      <div className="template-row">
        {PUSH_TEMPLATES.map((template) => (
          <form key={template.id} action={savePush}>
            <input type="hidden" name="template" value={template.id} />
            <input type="hidden" name="segment" value="members" />
            <button className="button" type="submit">
              {desk.live ? `Prepare “${template.title}”` : `Save “${template.title}”`}
            </button>
          </form>
        ))}
      </div>
      {confirming ? (
        <article className="panel">
          <h2>Send this notification?</h2>
          <p>
            <strong>{one(query, "title")}</strong>
          </p>
          <p>{one(query, "body")}</p>
          <p>
            {segmentLabel(one(query, "segment"))} · {one(query, "count")} people. This includes guests, not only
            members. This is the last step before it goes out. Nothing is sent until you confirm.
          </p>
          <form action={savePush}>
            <input type="hidden" name="title" value={one(query, "title")} />
            <input type="hidden" name="body" value={one(query, "body")} />
            <input type="hidden" name="segment" value={one(query, "segment")} />
            <input type="hidden" name="confirm" value="yes" />
            <button className="button" type="submit">
              Send to {one(query, "count")} people
            </button>
          </form>
        </article>
      ) : (
        <form className="form" action={savePush}>
          <label>
            Title
            <input name="title" required maxLength={80} defaultValue="Sunday at 10:30" />
          </label>
          <label>
            Body
            <textarea name="body" required maxLength={240} defaultValue="Sunday at 10:30 a.m." />
          </label>
          <label>
            Who
            <select name="segment" defaultValue="members">
              {SEGMENTS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label} ({desk.counts[id]})
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            {desk.live ? "Review before sending" : "Save draft"}
          </button>
        </form>
      )}
      {!drafts.locked && drafts.drafts.length > 0 ? (
        <article className="panel">
          <h2>Drafts saved here</h2>
          {drafts.drafts
            .slice()
            .reverse()
            .map((draft) => (
              <p key={draft.id}>
                <strong>{draft.title}</strong>
                {draft.body ? ` — ${draft.body}` : ""}
              </p>
            ))}
        </article>
      ) : null}
    </section>
  );
}
