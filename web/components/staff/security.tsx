import { formatChicago, labelRole, permissionMatrix, type ChurchStore } from "@onehope/server";

import { changeRoleAction, issueInviteAction } from "@/app/staff-actions";
import { CopyButton } from "@/components/staff/clipboard";

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

export function SecurityDesk({
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
  const added = one(query, "added");
  let people: ReturnType<ChurchStore["staffPeople"]> = [];
  let roles: ReturnType<ChurchStore["assignableRoles"]> = [];
  try {
    people = store.staffPeople(token);
    roles = store.assignableRoles(token);
  } catch {
    people = [];
  }
  const waiting = people.filter((person) => !person.claimed && person.email);
  return (
    <section>
      <h1>Roles</h1>
      <p className="help">
        How do I give someone a code? Pick their name and tap Create a code. Read it to them. They open the
        claim page on their phone. Nothing is emailed. Master Admin still takes both current Master Admins.
      </p>
      {one(query, "error") ? (
        <p className="notice">
          That did not work. They may already have a password, or that role is not yours to give.
        </p>
      ) : null}
      {one(query, "saved") ? <p className="notice">Saved.</p> : null}
      {added ? (
        <article className="panel">
          <h2>Code for {one(query, "name")}</h2>
          <p className="setup-key">{added}</p>
          <CopyButton value={added} label="Copy code" />
          <p className="muted">
            {one(query, "expires")
              ? `Expires ${formatChicago(Number(one(query, "expires")))}.`
              : "Expires in 7 days."}{" "}
            Nothing was emailed.
          </p>
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
    </section>
  );
}
