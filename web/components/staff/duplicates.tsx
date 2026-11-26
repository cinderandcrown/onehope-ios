import { formatChicago, isAccessError, type ChurchStore } from "@onehope/server";

import { dismissDuplicateAction, mergePeopleAction, undoMergeAction } from "@/app/import-actions";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function DuplicatesDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  let page: ReturnType<ChurchStore["duplicatePage"]>;
  try {
    page = store.duplicatePage(token);
  } catch (error) {
    if (isAccessError(error) && error.code === "forbidden") {
      return (
        <section>
          <h1>Duplicates</h1>
          <p>Pastors, the care team, and Master Admins can merge people.</p>
        </section>
      );
    }
    throw error;
  }
  const saved = one(query, "saved");
  const text =
    saved === "merged"
      ? "Merged. You can undo it for 7 days."
      : saved === "undone"
        ? "Undone. Both people are back."
        : saved === "different"
          ? "Noted. We will not suggest that pair again."
          : one(query, "error")
            ? "That did not work. Try again."
            : "";
  return (
    <section>
      <h1>Duplicates</h1>
      <p className="help">
        These look like the same person. Keep one, or say they are not the same. A merge can be undone for 7
        days. Nothing is deleted from the audit log.
      </p>
      {text ? <p className="notice">{text}</p> : null}
      {page.pairs.length === 0 ? (
        <p>No pairs look the same right now. When two people share an email, a phone, or a name, they show up here.</p>
      ) : (
        page.pairs.map((pair) => (
          <article className="card" key={`${pair.leftId}:${pair.rightId}`}>
            <h2>These look like the same person</h2>
            <p>{pair.why}</p>
            <ul className="list">
              <li>
                {pair.left.name}
                {pair.left.email ? ` · ${pair.left.email}` : ""}
                {pair.left.phone ? ` · ${pair.left.phone}` : ""}
                {pair.left.stage ? ` · ${pair.left.stage}` : ""}
              </li>
              <li>
                {pair.right.name}
                {pair.right.email ? ` · ${pair.right.email}` : ""}
                {pair.right.phone ? ` · ${pair.right.phone}` : ""}
                {pair.right.stage ? ` · ${pair.right.stage}` : ""}
              </li>
            </ul>
            <form action={mergePeopleAction}>
              <input type="hidden" name="keptId" value={pair.leftId} />
              <input type="hidden" name="mergedId" value={pair.rightId} />
              <button className="button block" type="submit">
                Keep {pair.left.name}
                {pair.left.email ? ` (${pair.left.email})` : ""}
              </button>
            </form>
            <form action={mergePeopleAction}>
              <input type="hidden" name="keptId" value={pair.rightId} />
              <input type="hidden" name="mergedId" value={pair.leftId} />
              <button className="button secondary" type="submit">
                Keep {pair.right.name}
                {pair.right.email ? ` (${pair.right.email})` : ""}
              </button>
            </form>
            <form action={dismissDuplicateAction}>
              <input type="hidden" name="leftId" value={pair.leftId} />
              <input type="hidden" name="rightId" value={pair.rightId} />
              <button className="button secondary" type="submit">
                Not the same
              </button>
            </form>
          </article>
        ))
      )}
      {page.merges.length > 0 ? (
        <>
          <h2>Merges you can still undo</h2>
          <ul className="list">
            {page.merges.map((merge) => (
              <li key={merge.id}>
                Kept {merge.keptName}. Undo until {formatChicago(merge.until)}.
                <form action={undoMergeAction}>
                  <input type="hidden" name="id" value={merge.id} />
                  <button className="button secondary" type="submit">
                    Undo merge
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
