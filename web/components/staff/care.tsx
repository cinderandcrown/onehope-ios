import { chicagoInputValue, formatChicago, type ChurchStore } from "@onehope/server";

import { moderatePrayerAction, updateFollowUpAction } from "@/app/actions";
import { confirmStepUpAction, moderateTestimonyAction } from "@/app/staff-actions";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function CareDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const care = store.ministry(token).care;
  const notice = one(query, "saved")
    ? "Saved. Nothing was texted or emailed."
    : one(query, "error") === "time"
      ? "Check the due date."
      : one(query, "error")
        ? "That did not save. If it asked you to confirm it's you, enter the 6-digit code and try again."
        : "";
  return (
    <section>
      <h1>Care</h1>
      <p className="help">
        How do I follow up? Read the name, assign it to someone on staff, add a private note and a due date,
        then mark Contacted after you talk. The app never texts or emails them for you.
      </p>
      {notice ? <p className="notice">{notice}</p> : null}
      {care.notes.length === 0 ? (
        <p>No care notes are visible to you.</p>
      ) : (
        care.notes.map((note) => (
          <article className="card" key={note.id}>
            <p>{note.body}</p>
          </article>
        ))
      )}
      {care.queue.locked ? (
        <article className="panel">
          <h2>Staff care queue</h2>
          <p>Confirm it is you again before this opens. Enter the 6-digit code from your authenticator.</p>
          <form className="form" action={confirmStepUpAction}>
            <input type="hidden" name="next" value="/care" />
            <label>
              Authentication code
              <input name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="\d{6}" />
            </label>
            <button className="button" type="submit">
              Confirm it's me
            </button>
          </form>
        </article>
      ) : (
        <CareQueue store={store} token={token} followUps={care.queue.followUps} />
      )}
    </section>
  );
}

function CareQueue({
  store,
  token,
  followUps,
}: {
  store: ChurchStore;
  token: string;
  followUps: Extract<ReturnType<ChurchStore["ministry"]>["care"]["queue"], { locked: false }>["followUps"];
}) {
  const assignees = store.careAssignees(token);
  const waiting = store.listPrayers(token).filter((prayer) => !prayer.approved && prayer.body && !prayer.reported);
  const reported = store.reportedPrayers(token);
  const testimonies = store.listTestimonies(token).filter((row) => !row.approved && row.body);
  return (
    <>
      <article className="panel">
        <h2>Next steps from the app</h2>
        {followUps.length === 0 ? (
          <p>
            No one has asked for a next step yet. Know Jesus, baptism, Growth Track, Plan a Visit, prayer
            contact requests, and Support/Assistance requests land here.
          </p>
        ) : (
          followUps.map((row) => (
            <form className="form care-card" action={updateFollowUpAction} key={row.id}>
              <input type="hidden" name="id" value={row.id} />
              <h3>
                {row.name || "Guest"} {row.member ? "(member)" : "(guest)"}
              </h3>
              <p>
                {row.label}
                {row.needs.length > 0 ? ` · ${row.needs.join(" · ")}` : ""}
              </p>
              <p className="muted">
                {formatChicago(row.createdAt)} ·{" "}
                {[row.email, row.phone].filter(Boolean).join(" · ") ||
                  (row.contactConsent ? "Account email" : "No contact shared")}
              </p>
              <label>
                Status
                <select name="status" defaultValue={row.status} aria-label={`Status for ${row.name}`}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <label>
                Assign to
                <select name="assigneeId" defaultValue={row.assigneeId ?? ""} aria-label={`Assign ${row.name}`}>
                  <option value="">No one yet</option>
                  {assignees.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due (Central, optional)
                <input
                  name="dueAt"
                  type="datetime-local"
                  defaultValue={row.dueAt === null ? "" : chicagoInputValue(row.dueAt)}
                />
              </label>
              <label>
                Staff note
                <textarea
                  name="staffNote"
                  maxLength={2000}
                  defaultValue={row.staffNote}
                  placeholder="Only staff can read this. It is not sent to them."
                />
              </label>
              <button className="button" type="submit">
                Save follow-up
              </button>
            </form>
          ))
        )}
      </article>
      <article className="panel">
        <h2>Prayers to share</h2>
        <p className="help">
          How do I share a prayer? Read it, then Share with the church or Keep private. Private stays off the
          wall. Nothing is texted.
        </p>
        {waiting.length === 0 ? <p>No prayer requests are waiting.</p> : null}
        {waiting.map((prayer) => (
          <form key={prayer.id} action={moderatePrayerAction}>
            <p>{prayer.body}</p>
            <input type="hidden" name="id" value={prayer.id} />
            <div className="template-row">
              <button className="button" name="approved" value="yes" type="submit">
                Share with the church
              </button>
              <button className="button secondary" name="approved" value="no" type="submit">
                Keep private
              </button>
            </div>
          </form>
        ))}
      </article>
      <article className="panel">
        <h2>Prayers someone reported</h2>
        <p className="help">
          A member asked us to look again. It is already off the wall. Share puts it back. Keep private leaves
          it off.
        </p>
        {reported.length === 0 ? <p>No reported prayers.</p> : null}
        {reported.map((prayer) => (
          <form key={prayer.id} action={moderatePrayerAction}>
            <p>{prayer.body}</p>
            <input type="hidden" name="id" value={prayer.id} />
            <div className="template-row">
              <button className="button" name="approved" value="yes" type="submit">
                Share again
              </button>
              <button className="button secondary" name="approved" value="no" type="submit">
                Keep off the wall
              </button>
            </div>
          </form>
        ))}
      </article>
      <article className="panel">
        <h2>Testimonies to approve</h2>
        <p className="help">
          How do I share a testimony? Read it. Share only if they already said yes. Decline keeps it off Home.
        </p>
        {testimonies.length === 0 ? <p>No testimonies are waiting.</p> : null}
        {testimonies.map((row) => (
          <form key={row.id} action={moderateTestimonyAction}>
            <p>
              <strong>{row.displayName}</strong>
            </p>
            <p>{row.body}</p>
            <input type="hidden" name="id" value={row.id} />
            <div className="template-row">
              <button className="button" name="approved" value="yes" type="submit">
                Share testimony
              </button>
              <button className="button secondary" name="approved" value="no" type="submit">
                Don't share
              </button>
            </div>
          </form>
        ))}
      </article>
    </>
  );
}
