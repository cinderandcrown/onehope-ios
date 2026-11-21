import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatChicago, isAccessError, type ChurchStore } from "@onehope/server";

import {
  allowContactAction,
  logTouchAction,
  setStageAction,
  tagPersonAction,
  untagPersonAction,
} from "@/app/people-actions";
import { withChurch } from "@/lib/church";
import { lastContactLabel, peopleNotice } from "@/lib/people-notices";
import { staffSession } from "@/lib/session";

type Care = ReturnType<ChurchStore["personCare"]>;

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { token } = await staffSession();
  let care: Care;
  try {
    care = await withChurch((store) => store.personCare(token, decodeURIComponent(id)), { token });
  } catch (error) {
    if (isAccessError(error)) {
      if (error.code === "unauthenticated" || error.code === "session_expired") redirect("/login");
      if (error.code === "forbidden") {
        return (
          <section>
            <h1>People</h1>
            <p>People is for pastors, the care team, kids directors and team leaders.</p>
          </section>
        );
      }
      notFound();
    }
    throw error;
  }
  const notice = peopleNotice(query);
  return (
    <section>
      <p>
        <Link href="/people">← All people</Link>
      </p>
      <h1>{care.displayName}</h1>
      <p className="muted">
        {care.roleLabel} · {care.stageLabel} · Last contact{" "}
        {lastContactLabel(care.lastContactAt, formatChicago)}
        {care.sample ? " · Sample" : ""}
      </p>
      {notice ? (
        <p
          className={notice.tone === "error" ? "notice error" : "notice"}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}
      {care.doNotContact ? (
        <article className="panel">
          <h2>They asked us not to contact them</h2>
          <p>Please do not call, text, email or visit. You can still pray for them and add private notes.</p>
          {care.mayEdit ? (
            <form action={allowContactAction}>
              <input type="hidden" name="personId" value={care.id} />
              <button className="button secondary" type="submit">
                They said it is okay again
              </button>
            </form>
          ) : null}
        </article>
      ) : null}

      <article className="panel">
        <h2>Contact</h2>
        <p>
          {care.email || "No email"} · {care.phone || "No phone"}
        </p>
        <p className="muted">
          {care.claimed ? "Has the app and a password." : "Has not set a password yet."}
        </p>
      </article>

      {care.mayEdit ? (
        <article className="panel">
          <h2>Log a touch</h2>
          <p className="help">
            What did you do, and how did it go? Notes are private to staff who can open People.
          </p>
          <form className="form" action={logTouchAction}>
            <input type="hidden" name="personId" value={care.id} />
            <fieldset className="touch-buttons">
              <legend>What did you do?</legend>
              {care.touchKinds.map((kind, index) => (
                <label key={kind.id}>
                  <input type="radio" name="kind" value={kind.id} defaultChecked={index === 0} required />{" "}
                  {kind.label}
                </label>
              ))}
            </fieldset>
            <label>
              How did it go?
              <select name="outcome" defaultValue="reached">
                {care.outcomes.map((outcome) => (
                  <option key={outcome.id} value={outcome.id}>
                    {outcome.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Note (optional)
              <textarea
                name="note"
                rows={3}
                maxLength={2000}
                placeholder="What should the next person know?"
              />
            </label>
            <button className="button" type="submit">
              Log it
            </button>
          </form>
        </article>
      ) : null}

      <article className="panel">
        <h2>Stage</h2>
        {care.mayEdit ? (
          <form className="form" action={setStageAction}>
            <input type="hidden" name="personId" value={care.id} />
            <label>
              Where are they on the path?
              <select name="stage" defaultValue={care.stage}>
                {care.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary" type="submit">
              Save stage
            </button>
          </form>
        ) : (
          <p>{care.stageLabel}</p>
        )}
      </article>

      <article className="panel">
        <h2>Tags</h2>
        <ul className="chips" aria-label={`Tags for ${care.displayName}`}>
          {care.tags.map((tag) => (
            <li key={tag.id}>
              {tag.name}
              {care.removableTagIds.includes(tag.id) ? (
                <form action={untagPersonAction}>
                  <input type="hidden" name="personId" value={care.id} />
                  <input type="hidden" name="tagId" value={tag.id} />
                  <button className="chip-remove" type="submit" aria-label={`Remove ${tag.name}`}>
                    ×
                  </button>
                </form>
              ) : null}
            </li>
          ))}
          {care.tags.length === 0 ? <li>No tags</li> : null}
        </ul>
        {care.addableTags.length > 0 ? (
          <form className="form" action={tagPersonAction}>
            <input type="hidden" name="personId" value={care.id} />
            <label>
              Add a tag
              <select name="tagId">
                {care.addableTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary" type="submit">
              Add tag
            </button>
          </form>
        ) : null}
      </article>

      <article className="panel">
        <h2>Timeline</h2>
        {care.touches.length === 0 ? <p>No touches yet. Be the first to reach out.</p> : null}
        <ol className="timeline" aria-label="Timeline">
          {care.touches.map((touch) => (
            <li key={touch.id}>
              <time>{formatChicago(touch.at)}</time>
              <p>
                <strong>{touch.kindLabel}</strong> · {touch.outcomeLabel} · by {touch.byName}
              </p>
              {touch.note ? <p>{touch.note}</p> : null}
            </li>
          ))}
        </ol>
      </article>

      {care.followUps.length > 0 ? (
        <article className="panel">
          <h2>Next steps they asked for</h2>
          <ul className="list">
            {care.followUps.map((row) => (
              <li key={row.id}>
                {row.label} · {row.status} · {formatChicago(row.createdAt)}
              </li>
            ))}
          </ul>
          <Link href="/care">Open Care</Link>
        </article>
      ) : null}
    </section>
  );
}
