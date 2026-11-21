import Link from "next/link";
import { formatChicago, labelRole, type ChurchStore } from "@onehope/server";

import { addPersonAction, editPersonAction } from "@/app/actions";
import { changeRoleAction, undoPersonAction } from "@/app/staff-actions";
import { CopyButton } from "@/components/staff/clipboard";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function PeopleDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  let people: ReturnType<ChurchStore["staffPeople"]>;
  let roles: ReturnType<ChurchStore["assignableRoles"]>;
  let directory: ReturnType<ChurchStore["directory"]>;
  try {
    people = store.staffPeople(token);
    roles = store.assignableRoles(token);
    directory = store.directory(token);
  } catch {
    return (
      <section>
        <h1>People</h1>
        <p>Adding people is for pastors and team leaders.</p>
      </section>
    );
  }
  const added = one(query, "added");
  const expires = Number(one(query, "expires"));
  const notice = one(query, "saved")
    ? "Saved."
    : one(query, "error")
      ? "That did not work. If they already set a password, the add can't be undone here."
      : "";
  return (
    <section>
      <h1>People</h1>
      <p className="help">
        How do I add someone? Type their name and email. A code appears on this screen. Read it to them, or
        they open the claim page on their phone and type it. Nothing is emailed. You can undo the add until
        they set a password.
      </p>
      {notice ? <p className="notice">{notice}</p> : null}
      {added ? (
        <article className="panel">
          <h2>Give this code to {one(query, "name") || "them"}</h2>
          <p className="setup-key">{added}</p>
          <div className="template-row">
            <CopyButton value={added} label="Copy code" />
            <Link className="button secondary" href="/claim">
              Open the claim page
            </Link>
          </div>
          <p className="muted">
            {Number.isFinite(expires) && expires > 0
              ? `This code expires ${formatChicago(expires)}.`
              : "This code expires in 7 days."}{" "}
            Nothing was emailed.
          </p>
          {one(query, "id") ? (
            <form action={undoPersonAction}>
              <input type="hidden" name="id" value={one(query, "id")} />
              <button className="button secondary" type="submit">
                Undo add
              </button>
            </form>
          ) : null}
        </article>
      ) : null}
      <form className="form" action={addPersonAction}>
        <label>
          Name
          <input name="displayName" required placeholder="Name" />
        </label>
        <label>
          Email
          <input name="email" type="email" required placeholder="Email" />
        </label>
        <label>
          Phone (optional)
          <input name="phone" placeholder="Phone" />
        </label>
        <button className="button" type="submit">
          Add someone
        </button>
      </form>
      {people.map((person) => (
        <article className="panel" key={person.id}>
          <form className="form" action={editPersonAction}>
            <input type="hidden" name="id" value={person.id} />
            <label>
              Name
              <input name="displayName" defaultValue={person.displayName} aria-label={`Name for ${person.displayName}`} />
            </label>
            <label>
              Phone
              <input name="phone" defaultValue={person.phone} aria-label={`Phone for ${person.displayName}`} />
            </label>
            <p className="muted">
              {person.email || "No email"} · {person.claimed ? "Password set" : "Waiting for them to set a password"}
            </p>
            <button className="button" type="submit">
              Save {person.displayName}
            </button>
          </form>
          {roles.length > 0 ? (
            <form className="form" action={changeRoleAction}>
              <input type="hidden" name="personId" value={person.id} />
              <label>
                Role
                <select name="role" defaultValue={person.role} aria-label={`Role for ${person.displayName}`}>
                  {roles.some((role) => role.id === person.role) ? null : (
                    <option value={person.role}>{labelRole(person.role)}</option>
                  )}
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
          {!person.claimed && !person.sample ? (
            <form action={undoPersonAction}>
              <input type="hidden" name="id" value={person.id} />
              <button className="button secondary" type="submit">
                Undo add
              </button>
            </form>
          ) : null}
        </article>
      ))}
      <h2>Directory</h2>
      <p className="help">This is who chose to be listed. Hidden means they did not share that detail.</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
          </tr>
        </thead>
        <tbody>
          {directory.map((person) => (
            <tr key={person.id}>
              <td>{person.displayName}</td>
              <td>{person.email || "Hidden"}</td>
              <td>{person.phone || "Hidden"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
