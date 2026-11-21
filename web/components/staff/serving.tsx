import type { ChurchStore } from "@onehope/server";

import { assignServingAction, undoServingAction } from "@/app/staff-actions";

const SPOTS = ["Door", "Kids", "Coffee", "Parking", "Welcome"] as const;

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function ServingDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  let rows: ReturnType<ChurchStore["serving"]>;
  let people: { id: string; displayName: string }[];
  try {
    rows = store.serving(token);
    people = store
      .staffPeople(token)
      .filter((person) => !person.sample || person.displayName.length > 0)
      .map((person) => ({ id: person.id, displayName: person.displayName }));
  } catch {
    return (
      <section>
        <h1>Serving</h1>
        <p>Filling a spot is for pastors and team leaders.</p>
      </section>
    );
  }
  const notice = one(query, "saved")
    ? "Saved. They can say yes in the app. You can undo it while it still says waiting."
    : one(query, "error")
      ? "That spot could not be changed. If they already answered, talk with them."
      : "";
  return (
    <section>
      <h1>Serving</h1>
      <p className="help">
        How do I fill a spot? Pick a person who is already in the church, pick the spot, and tap Ask them.
        They say yes in the app. Undo works only while they have not answered. Nothing is texted.
      </p>
      {notice ? <p className="notice">{notice}</p> : null}
      <div className="template-row">
        {SPOTS.map((spot) => (
          <span className="badge" key={spot}>
            {spot}
          </span>
        ))}
      </div>
      <form className="form" action={assignServingAction}>
        <label>
          Person
          <select name="personId" required defaultValue="">
            <option value="" disabled>
              Choose someone
            </option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Spot
          <input name="position" required list="spots" placeholder="Door, Kids, Coffee..." />
        </label>
        <datalist id="spots">
          {SPOTS.map((spot) => (
            <option key={spot} value={spot} />
          ))}
        </datalist>
        <button className="button" type="submit">
          Ask them to serve
        </button>
      </form>
      {rows.length === 0 ? (
        <p>No one is on the schedule yet. Ask someone above.</p>
      ) : (
        rows.map((row) => (
          <article className="card" key={row.id}>
            <h2>{row.position}</h2>
            <p>
              {row.displayName} · {row.status === "pending" ? "Waiting for their yes" : row.status}
            </p>
            {row.status === "pending" ? (
              <form action={undoServingAction}>
                <input type="hidden" name="id" value={row.id} />
                <button className="button secondary" type="submit">
                  Undo
                </button>
              </form>
            ) : null}
          </article>
        ))
      )}
    </section>
  );
}
