import Link from "next/link";
import { formatChicago, isAccessError, type ChurchStore } from "@onehope/server";

import {
  commitImportAction,
  saveMappingAction,
  undoImportAction,
  uploadImportAction,
} from "@/app/import-actions";
import { confirmStepUpAction } from "@/app/staff-actions";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function notice(query: Record<string, string | string[] | undefined>) {
  const error = one(query, "error");
  if (error === "file") return "Choose a CSV file. Put the column names in the first row.";
  if (error === "stepup") return "Confirm it's you again, then try once more.";
  if (error === "invalid") return "That did not work. Check the file and the columns, then try again.";
  if (one(query, "saved") === "undone") {
    return "Undone. People this import added are gone, and anyone it changed is back to how they were.";
  }
  return "";
}

function StepUp() {
  return (
    <article className="panel">
      <h2>Confirm it is you</h2>
      <p>Importing people needs a fresh code from your authenticator app. Nothing is saved until you confirm.</p>
      <form className="form" action={confirmStepUpAction}>
        <input type="hidden" name="next" value="/import" />
        <label>
          Authentication code
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="\d{6}" />
        </label>
        <button className="button block" type="submit">
          Confirm it is me
        </button>
      </form>
    </article>
  );
}

export async function ImportDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  let page: ReturnType<ChurchStore["importPage"]>;
  try {
    page = store.importPage(token, { id: one(query, "id"), step: one(query, "step") });
  } catch (error) {
    if (isAccessError(error) && error.code === "step_up_required") {
      return (
        <section>
          <h1>Import people</h1>
          <StepUp />
        </section>
      );
    }
    if (isAccessError(error) && error.code === "forbidden") {
      return (
        <section>
          <h1>Import people</h1>
          <p>Only a pastor or a Master Admin can import people.</p>
        </section>
      );
    }
    throw error;
  }
  const text = notice(query);
  return (
    <section>
      <h1>Import people</h1>
      <p className="help">
        Upload a spreadsheet or a one-time Planning Center people export. We match the columns, show you the
        first 10 rows, then import. Nothing is connected to Planning Center, and you can undo for 24 hours.
      </p>
      {text ? <p className="notice">{text}</p> : null}
      {page.step === "upload" ? <Upload page={page} /> : null}
      {page.step === "match" ? <Match page={page} /> : null}
      {page.step === "preview" ? <Preview page={page} /> : null}
      {page.step === "summary" ? <Summary page={page} /> : null}
    </section>
  );
}

function Upload({ page }: { page: Extract<ReturnType<ChurchStore["importPage"]>, { step: "upload" }> }) {
  return (
    <>
      {page.unfinished.length > 0 ? (
        <article className="panel">
          <h2>A file stopped partway</h2>
          <p>Upload the same file again and we will continue where it stopped.</p>
          <ul className="list">
            {page.unfinished.map((row) => (
              <li key={row.id}>
                {row.filename} · {row.received} of {row.total} parts received
              </li>
            ))}
          </ul>
        </article>
      ) : (
        <p>Start by choosing the file. We will not add anyone until you tap Import these people.</p>
      )}
      <form className="form" action={uploadImportAction}>
        <label>
          Spreadsheet
          <input name="file" type="file" accept=".csv,text/csv,text/plain" required />
        </label>
        <button className="button block" type="submit">
          Look at this file
        </button>
      </form>
      <Recent rows={page.recent} />
    </>
  );
}

function Match({ page }: { page: Extract<ReturnType<ChurchStore["importPage"]>, { step: "match" }> }) {
  return (
    <>
      <h2>Match the columns</h2>
      <p className="help">
        {page.planningCenter
          ? "This looks like a one-time Planning Center people export. Check the matches, then preview."
          : "We guessed what each column means. Change any that are wrong. Skip a column you do not want."}
      </p>
      {page.received < page.totalBatches ? (
        <p className="notice">
          This file is only partly uploaded ({page.received} of {page.totalBatches}). Upload the same file again
          from the start of Import.
        </p>
      ) : null}
      <form className="form" action={saveMappingAction}>
        <input type="hidden" name="id" value={page.id} />
        <input type="hidden" name="columns" value={page.headers.length} />
        {page.headers.map((header) => (
          <label key={header.index}>
            {header.name}
            <select name={`field_${header.index}`} defaultValue={header.field} aria-label={`Match ${header.name}`}>
              {page.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button className="button block" type="submit" disabled={page.received < page.totalBatches}>
          Preview the first 10
        </button>
      </form>
    </>
  );
}

function Preview({ page }: { page: Extract<ReturnType<ChurchStore["importPage"]>, { step: "preview" }> }) {
  return (
    <>
      <h2>Preview</h2>
      <p className="help">
        These are the first {page.rows.length} of {page.total} rows in {page.filename}. A possible duplicate is
        flagged. You can still import them and sort it out afterward.
      </p>
      {page.rows.length === 0 ? <p>This file has no people to preview. Go back and choose a different file.</p> : null}
      <div className="table-wrap">
        <table aria-label="Preview">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>What we will do</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => (
              <tr key={row.line}>
                <td>{row.name}</td>
                <td>{row.email || "—"}</td>
                <td>{row.phone || "—"}</td>
                <td>
                  {row.note}
                  {row.flag ? <span className="muted"> · {row.flag}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={commitImportAction}>
        <input type="hidden" name="id" value={page.id} />
        <button className="button block" type="submit">
          Import these people
        </button>
      </form>
      <p>
        <Link href={`/import?id=${encodeURIComponent(page.id)}&step=match`}>Change the columns</Link>
      </p>
    </>
  );
}

function Summary({ page }: { page: Extract<ReturnType<ChurchStore["importPage"]>, { step: "summary" }> }) {
  const counts = page.counts;
  return (
    <>
      <h2>Import summary</h2>
      {page.status === "undone" ? (
        <p>This import was undone. The church is back to how it was before this file.</p>
      ) : (
        <p>Here is what happened to {page.filename}.</p>
      )}
      <ul className="list" aria-label="Import results">
        <li>Added {counts?.added ?? 0}</li>
        <li>Updated {counts?.updated ?? 0}</li>
        <li>Skipped {counts?.skipped ?? 0}</li>
      </ul>
      {counts && counts.reasons.length > 0 ? (
        <>
          <h3>Why rows were skipped</h3>
          <ul className="list">
            {counts.reasons.map((reason) => (
              <li key={reason.why}>
                {reason.why} · {reason.count}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {page.canUndo ? (
        <form action={undoImportAction}>
          <input type="hidden" name="id" value={page.id} />
          <p className="muted">You can undo until {formatChicago(page.undoUntil ?? 0)}.</p>
          <button className="button block" type="submit">
            Undo this import
          </button>
        </form>
      ) : (
        <p>Undo is available for 24 hours after an import.</p>
      )}
      <p>
        <Link className="button secondary" href="/import">
          Import another file
        </Link>
      </p>
      <Recent rows={page.recent} />
    </>
  );
}

function Recent({
  rows,
}: {
  rows: { id: string; filename: string; status: string; added: number; canUndo: boolean }[];
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <h2>Recent imports</h2>
      <ul className="list">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/import?id=${encodeURIComponent(row.id)}&step=summary`}>{row.filename}</Link>
            {row.status === "imported" ? ` · added ${row.added}` : ""}
            {row.status === "undone" ? " · undone" : ""}
            {row.canUndo ? " · undo is still open" : ""}
          </li>
        ))}
      </ul>
    </>
  );
}
