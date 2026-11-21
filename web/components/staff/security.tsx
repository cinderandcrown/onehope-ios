import { formatChicago, labelRole, permissionMatrix, type ChurchStore } from "@onehope/server";

import { changeRoleAction, clearIssuedAction, issueInviteAction } from "@/app/staff-actions";
import { CopyButton } from "@/components/staff/clipboard";
import { readIssued } from "@/lib/issued-code";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const columns = [
  "view_all_giving",
  "view_care_notes",
  "view_kids_medical",
  "manage_integrations",
  "propose_master_admin",
] as const;

export async function SecurityDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const seats = store.seats();
  const matrix = permissionMatrix();
  let people: ReturnType<ChurchStore["staffPeople"]> = [];
  let roles: ReturnType<ChurchStore["assignableRoles"]> = [];
  try {
    people = store.staffPeople(token);
    roles = store.assignableRoles(token);
  } catch {
    people = [];
  }
  const issued = await readIssued("security");
  const waiting = people.filter((person) => person.canInvite && person.email);
  return (
    <section>
      <h1>Roles</h1>
      <p className="help">
        How do I give someone a code? Pick their name and tap Create a code. Read it to them. They open the
        claim page on their phone. Nothing is emailed. You can make a code or change a role only for roles
        below your own level. A pastor or Master Admin seat needs a Master Admin. Changing Master Admin still takes both
        current Master Admins.
      </p>
      {one(query, "error") ? (
        <p className="notice">
          That did not work. They may already have a password, or that role is not yours to give.
        </p>
      ) : null}
      {one(query, "saved") ? <p className="notice">Saved.</p> : null}
      {issued ? (
        <article className="panel">
          <h2>Code for {issued.name}</h2>
          <p className="setup-key">{issued.code}</p>
          <CopyButton value={issued.code} label="Copy code" />
          <p className="muted">
            Expires {formatChicago(issued.expires)}. Nothing was emailed.
          </p>
          <form action={clearIssuedAction}>
            <input type="hidden" name="desk" value="security" />
            <button className="button secondary" type="submit">
              Hide this code
            </button>
          </form>
        </article>
      ) : null}
      {waiting.length > 0 ? (
        <form className="form" action={issueInviteAction}>
          <label>
            Who needs a code?
            <select name="email" required defaultValue={waiting[0]?.email}>
              {waiting.map((person) => (
                <option key={person.id} value={person.email}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Create a code
          </button>
        </form>
      ) : (
        <p>Everyone here already has a password. Add someone on People first.</p>
      )}
      {roles.length > 0 && people.length > 0 ? (
        <form className="form" action={changeRoleAction}>
          <input type="hidden" name="next" value="/security" />
          <label>
            Person
            <select name="personId" required>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName} · {labelRole(person.role)}
                </option>
              ))}
            </select>
          </label>
          <label>
            New role
            <select name="role" required>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary" type="submit">
            Save role
          </button>
        </form>
      ) : null}
      <article className="panel">
        <h2>Master Admin</h2>
        <p>
          {seats.primary.name} · {seats.primary.email || "email not set"} ·{" "}
          {seats.primary.filled ? "seated" : "open"}
        </p>
        <p>
          {seats.secondary.name} · {seats.secondary.email || "email not set"} ·{" "}
          {seats.secondary.filled ? "seated" : "open"}
        </p>
        <p>Changing this role takes both current Master Admins. Sensitive records still ask for the code again.</p>
      </article>
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Role</th>
            {columns.map((column) => (
              <th key={column}>{column.replaceAll("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.role}>
              <td>{labelRole(row.role)}</td>
              {columns.map((column) => (
                <td key={column} className={row.grants[column] ? "yes" : "no"}>
                  {row.grants[column] ? "Yes" : "No"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}
