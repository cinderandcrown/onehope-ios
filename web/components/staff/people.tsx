import Link from "next/link";
import { formatChicago, labelRole, type ChurchStore } from "@onehope/server";

import { addPersonAction, editPersonAction } from "@/app/actions";
import { changeRoleAction, clearIssuedAction, undoPersonAction } from "@/app/staff-actions";
import { archiveTagAction, createTagAction, deleteListAction, saveListAction } from "@/app/people-actions";
import { CopyButton } from "@/components/staff/clipboard";
import { readIssued } from "@/lib/issued-code";
import { lastContactLabel, peopleNotice } from "@/lib/people-notices";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function PeopleDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const filter = {
    q: one(query, "q"),
    stage: one(query, "stage"),
    tagId: one(query, "tag"),
    quiet: one(query, "quiet") === "1",
    offset: Number.parseInt(one(query, "from") || "0", 10) || 0,
    limit: 100,
    listId: one(query, "list"),
    faithStep: one(query, "faith"),
    source: one(query, "source"),
    ownerId: one(query, "owner"),
    seen: one(query, "seen"),
    contact: one(query, "contact"),
    task: one(query, "task"),
  };
  let care: ReturnType<ChurchStore["peopleDirectory"]> | null = null;
  let tags: ReturnType<ChurchStore["careTags"]> | null = null;
  try {
    care = store.peopleDirectory(token, filter);
    tags = store.careTags(token);
  } catch {
    care = null;
  }
  let people: ReturnType<ChurchStore["staffPeople"]> = [];
  let roles: ReturnType<ChurchStore["assignableRoles"]> = [];
  let directory: ReturnType<ChurchStore["directory"]> = [];
  let editor = true;
  try {
    people = store.staffPeople(token);
    roles = store.assignableRoles(token);
    directory = store.directory(token);
  } catch {
    editor = false;
  }
  if (!care && !editor) {
    return (
      <section>
        <h1>People</h1>
        <p>People is for pastors, the care team, kids directors and team leaders.</p>
      </section>
    );
  }
  const issued = editor ? await readIssued("people") : null;
  const careNotice = peopleNotice(query);
  const notice = careNotice
    ? careNotice.text
    : one(query, "saved")
      ? "Saved."
      : one(query, "error")
        ? "That did not work. Undo is only for someone you added in the last 10 minutes."
        : "";
  const applied = care?.filters;
  const pageLink = (from: number) => {
    const params = new URLSearchParams();
    if (filter.q) params.set("q", filter.q);
    if (care?.activeList) params.set("list", care.activeList.id);
    else if (applied) {
      if (applied.stage) params.set("stage", applied.stage);
      if (applied.tagIds[0]) params.set("tag", applied.tagIds[0]);
      if (applied.faithSteps[0]) params.set("faith", applied.faithSteps[0]);
      if (applied.source) params.set("source", applied.source);
      if (applied.ownerId) params.set("owner", applied.ownerId);
      if (applied.seen) params.set("seen", applied.seen);
      if (applied.contact) params.set("contact", applied.contact);
      if (applied.task) params.set("task", applied.task);
      if (applied.quiet) params.set("quiet", "1");
    }
    if (from > 0) params.set("from", String(from));
    const text = params.toString();
    return text ? `/people?${text}` : "/people";
  };
  return (
    <section>
      <h1>People</h1>
      <p className="help">
        How do I add someone? Type their name and email. A code appears on this screen. Read it to them, or
        they open the claim page on their phone and type it. Nothing is emailed. You can undo the add for 10
        minutes, until they set a password. Staff and Master Admin seats cannot be undone here.
      </p>
      {notice ? <p className="notice">{notice}</p> : null}
      {issued ? (
        <article className="panel">
          <h2>Give this code to {issued.name || "them"}</h2>
          <p className="setup-key">{issued.code}</p>
          <div className="template-row">
            <CopyButton value={issued.code} label="Copy code" />
            <Link className="button secondary" href="/claim">
              Open the claim page
            </Link>
          </div>
          <p className="muted">
            {issued.expires > 0
              ? `This code expires ${formatChicago(issued.expires)}.`
              : "This code expires in 7 days."}{" "}
            Nothing was emailed.
          </p>
          {issued.personId ? (
            <form action={undoPersonAction}>
              <input type="hidden" name="id" value={issued.personId} />
              <button className="button secondary" type="submit">
                Undo add
              </button>
            </form>
          ) : null}
          <form action={clearIssuedAction}>
            <input type="hidden" name="desk" value="people" />
            <button className="button secondary" type="submit">
              Hide this code
            </button>
          </form>
        </article>
      ) : null}
      {care ? (
        <>
          <h2>Everyone{care.seesEveryone ? "" : " you look after"}</h2>
          <p className="help">
            Search by name, email or phone. Quiet means nobody has called, texted, visited or prayed with them
            in 30 days. Tap a name to open their page and log a touch.
          </p>
          <form className="form filters" method="get" action="/people" role="search">
            <label>
              Search
              <input name="q" defaultValue={filter.q} placeholder="Name, email or phone" />
            </label>
            <label>
              Stage
              <select name="stage" defaultValue={applied?.stage ?? ""}>
                <option value="">Any stage</option>
                {care.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tag
              <select name="tag" defaultValue={applied?.tagIds[0] ?? ""}>
                <option value="">Any tag</option>
                {care.tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Faith step
              <select name="faith" defaultValue={applied?.faithSteps[0] ?? ""}>
                <option value="">Any faith step</option>
                {care.faithSteps.map((step) => (
                  <option key={step.id} value={step.id}>
                    {step.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Last contact
              <select name="contact" defaultValue={applied?.contact ?? ""}>
                {care.windows.map((window) => (
                  <option key={`contact-${window.id || "any"}`} value={window.id}>
                    {window.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Last seen
              <select name="seen" defaultValue={applied?.seen ?? ""}>
                {care.windows.map((window) => (
                  <option key={`seen-${window.id || "any"}`} value={window.id}>
                    {window.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              How they found us
              <select name="source" defaultValue={applied?.source ?? ""}>
                <option value="">Any source</option>
                {care.sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Who looks after them
              <select name="owner" defaultValue={applied?.ownerId ?? ""}>
                <option value="">Anyone</option>
                {care.owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Open task
              <select name="task" defaultValue={applied?.task ?? ""}>
                <option value="">Any</option>
                <option value="open">Has an open task</option>
                <option value="none">No open task</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" name="quiet" value="1" defaultChecked={applied?.quiet ?? false} /> Only quiet
              (30+ days)
            </label>
            <div className="template-row">
              <button className="button" type="submit">
                Show
              </button>
              <Link className="button secondary" href="/people">
                Clear
              </Link>
            </div>
          </form>
          <h3>Saved lists</h3>
          {care.activeList ? <p>Showing the list “{care.activeList.name}”. It is calculated now, not a saved copy.</p> : null}
          {care.lists.length === 0 ? (
            <p>No saved lists yet. Set a filter above, name it, and tap Save this list.</p>
          ) : (
            <ul className="list" aria-label="Saved lists">
              {care.lists.map((list) => (
                <li key={list.id}>
                  <Link href={`/people?list=${encodeURIComponent(list.id)}`}>{list.name}</Link>
                  {list.shared ? " · shared" : ""}
                  {list.mine ? (
                    <form action={deleteListAction} className="inline">
                      <input type="hidden" name="id" value={list.id} />
                      <button className="button secondary" type="submit">
                        Delete {list.name}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <form className="form" action={saveListAction}>
            <input type="hidden" name="stage" value={applied?.stage ?? ""} />
            <input type="hidden" name="tag" value={applied?.tagIds[0] ?? ""} />
            <input type="hidden" name="faith" value={applied?.faithSteps[0] ?? ""} />
            <input type="hidden" name="source" value={applied?.source ?? ""} />
            <input type="hidden" name="owner" value={applied?.ownerId ?? ""} />
            <input type="hidden" name="seen" value={applied?.seen ?? ""} />
            <input type="hidden" name="contact" value={applied?.contact ?? ""} />
            <input type="hidden" name="task" value={applied?.task ?? ""} />
            {applied?.quiet ? <input type="hidden" name="quiet" value="1" /> : null}
            <label>
              List name
              <input name="name" required maxLength={60} placeholder="Guests to call" />
            </label>
            {care.mayShareLists ? (
              <label className="check">
                <input type="checkbox" name="shared" value="yes" /> Share with the team
              </label>
            ) : null}
            <button className="button secondary" type="submit">
              Save this list
            </button>
          </form>
          {care.mayImport ? (
            <p>
              <Link href="/import">Import a spreadsheet</Link>
            </p>
          ) : null}
          {care.mayMerge ? (
            <p>
              <Link href="/duplicates">Review duplicates</Link>
            </p>
          ) : null}
          <p className="muted" aria-live="polite">
            {care.total === 1 ? "1 person" : `${care.total} people`}
            {care.total > care.rows.length
              ? ` · showing ${care.offset + 1}-${care.offset + care.rows.length}`
              : ""}
          </p>
          <div className="table-wrap">
            <table aria-label="People">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Stage</th>
                  <th>Tags</th>
                  <th>Last contact</th>
                </tr>
              </thead>
              <tbody>
                {care.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/person/${encodeURIComponent(row.id)}`}>{row.displayName}</Link>
                      {row.doNotContact ? <span className="muted"> · do not contact</span> : null}
                    </td>
                    <td>{row.stageLabel}</td>
                    <td>{row.tags.map((tag) => tag.name).join(", ") || "None"}</td>
                    <td>
                      {lastContactLabel(row.lastContactAt, formatChicago)}
                      {row.quiet ? <span className="muted"> · quiet</span> : null}
                    </td>
                  </tr>
                ))}
                {care.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Nobody matches. Try fewer filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {care.total > care.offset + care.rows.length || care.offset > 0 ? (
            <div className="template-row">
              {care.offset > 0 ? (
                <Link className="button secondary" href={pageLink(Math.max(care.offset - care.limit, 0))}>
                  Previous
                </Link>
              ) : null}
              {care.total > care.offset + care.rows.length ? (
                <Link className="button secondary" href={pageLink(care.offset + care.limit)}>
                  Next
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
      {tags ? (
        <>
          <h2 id="tags">Tags and teams</h2>
          <p className="help">
            Tags group people, like Greeters or New here. A team tag also names its leaders. Team leaders see
            the people on teams they lead.
          </p>
          <ul className="list">
            {tags.tags.map((tag) => (
              <li key={tag.id}>
                <strong>{tag.name}</strong> ·{" "}
                {tag.kind === "team" ? "Team" : tag.kind === "ministry" ? "Ministry" : "Tag"} ·{" "}
                {tag.people === 1 ? "1 person" : `${tag.people} people`}
                {tag.leaders.length > 0 ? ` · led by ${tag.leaders.join(", ")}` : ""}
                {tags.mayManage ? (
                  <form action={archiveTagAction} className="inline">
                    <input type="hidden" name="tagId" value={tag.id} />
                    <button className="button secondary" type="submit" aria-label={`Archive ${tag.name}`}>
                      Archive
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
            {tags.tags.length === 0 ? <li>No tags yet.</li> : null}
          </ul>
          {tags.mayManage ? (
            <form className="form" action={createTagAction}>
              <label>
                New tag name
                <input name="name" required maxLength={40} placeholder="Greeters" />
              </label>
              <label>
                Kind
                <select name="kind" defaultValue="custom">
                  <option value="custom">Tag</option>
                  <option value="team">Team</option>
                  <option value="ministry">Ministry</option>
                </select>
              </label>
              <label>
                Leaders (teams only)
                <select name="leaderIds" multiple size={Math.min(Math.max(tags.leaders.length, 2), 6)}>
                  {tags.leaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>
                      {leader.displayName} · {leader.roleLabel}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button" type="submit">
                Add tag
              </button>
            </form>
          ) : null}
        </>
      ) : null}
      {editor ? (
        <>
          <h2>Add someone</h2>
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
          <details className="panel">
            <summary>Edit names, phones and roles ({people.length})</summary>
            {people.map((person) => (
              <article className="panel" key={person.id}>
                <form className="form" action={editPersonAction}>
                  <input type="hidden" name="id" value={person.id} />
                  <label>
                    Name
                    <input
                      name="displayName"
                      defaultValue={person.displayName}
                      aria-label={`Name for ${person.displayName}`}
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      name="phone"
                      defaultValue={person.phone}
                      aria-label={`Phone for ${person.displayName}`}
                    />
                  </label>
                  <p className="muted">
                    {person.email || "No email"} ·{" "}
                    {person.claimed ? "Password set" : "Waiting for them to set a password"}
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
                      <select
                        name="role"
                        defaultValue={person.role}
                        aria-label={`Role for ${person.displayName}`}
                      >
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
                {person.canUndo ? (
                  <form action={undoPersonAction}>
                    <input type="hidden" name="id" value={person.id} />
                    <button className="button secondary" type="submit">
                      Undo add
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </details>
        </>
      ) : null}
      {editor ? (
        <>
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
        </>
      ) : null}
    </section>
  );
}
