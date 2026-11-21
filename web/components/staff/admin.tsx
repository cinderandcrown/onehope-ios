import { formatChicago, parseChicagoLocal, type ChurchStore } from "@onehope/server";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function AdminDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const status = store.status("1.0.0");
  const from = one(query, "from");
  const to = one(query, "to");
  let rows: ReturnType<ChurchStore["audit"]> | null = null;
  let denied = false;
  try {
    const start = from ? parseChicagoLocal(from) : null;
    const endStart = to ? parseChicagoLocal(to) : null;
    rows = store.audit(token, {
      from: start,
      to: endStart === null ? null : endStart + 24 * 60 * 60 * 1000 - 1,
    });
  } catch {
    denied = true;
    rows = null;
  }
  const shown = (rows ?? []).slice(-200);
  const download = `/api/audit?format=csv${from ? `&from=${encodeURIComponent(from)}` : ""}${to ? `&to=${encodeURIComponent(to)}` : ""}`;
  return (
    <section>
      <h1>Admin</h1>
      <p className="help">
        How do I see what staff opened? Pick a start and end date, then Show. Download saves a spreadsheet.
        Dates are Central time. This list does not include passwords or codes.
      </p>
      <p>
        Encryption: {status.fieldEncryption}. Giving live: {status.givingLive ? "yes" : "no"}. Apple push: off
        in this build.
      </p>
      {denied ? (
        <p>The audit log is for pastors.</p>
      ) : (
        <>
          <form className="form" method="get" action="/admin">
            <label>
              From
              <input name="from" type="date" defaultValue={from} />
            </label>
            <label>
              To
              <input name="to" type="date" defaultValue={to} />
            </label>
            <button className="button" type="submit">
              Show
            </button>
          </form>
          <p>
            <a className="button secondary" href={download}>
              Download spreadsheet
            </a>
          </p>
          {shown.length === 0 ? (
            <p>No audit rows in those dates. Try a wider range, or leave the dates blank to see everything.</p>
          ) : (
            <>
              <p className="muted">
                Showing {shown.length}
                {(rows?.length ?? 0) > shown.length ? ` of ${rows?.length}. The download has every row.` : " rows."}
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Who</th>
                      <th>Action</th>
                      <th>Record</th>
                      <th>Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatChicago(entry.at)}</td>
                        <td>{entry.actorName}</td>
                        <td>{entry.action}</td>
                        <td>
                          {entry.resource} {entry.resourceId}
                        </td>
                        <td>{entry.tier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
