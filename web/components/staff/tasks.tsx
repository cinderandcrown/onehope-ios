import Link from "next/link";
import { formatChicago, type ChurchStore } from "@onehope/server";

import { completeTaskAction, reassignTaskAction, togglePlaybookAction } from "@/app/care-actions";
import { CopyButton } from "@/components/staff/clipboard";
import { peopleNotice } from "@/lib/people-notices";

type Query = Record<string, string | string[] | undefined>;
type Task = ReturnType<ChurchStore["careTasksFor"]>["tasks"][number];

function one(query: Query, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** Overview card: what needs a call today. Hidden for roles that do not work care tasks. */
export function TodayCard({ store, token }: { store: ChurchStore; token: string }) {
  let today: ReturnType<ChurchStore["careToday"]>;
  try {
    today = store.careToday(token);
  } catch {
    return null;
  }
  return (
    <section className="panel today-card" aria-labelledby="today-heading">
      <h2 id="today-heading">Today</h2>
      <div className="desk-grid">
        <article className={today.overdue > 0 ? "desk-card late" : "desk-card"}>
          <h3>Overdue</h3>
          <p className="count">{today.overdue}</p>
          <p className="help">Your tasks past their day.</p>
        </article>
        <article className="desk-card">
          <h3>Due today</h3>
          <p className="count">{today.today}</p>
          <p className="help">Your calls, texts and cards for today.</p>
        </article>
        <article className={today.salvationLate > 0 ? "desk-card late" : "desk-card"}>
          <h3>Decisions this week</h3>
          <p className="count">{today.decisionsThisWeek}</p>
          <p className="help">
            {today.decisionsWaiting} waiting for a first call · {today.reachedIn24} reached within 24 hours
            {today.salvationLate > 0 ? ` · ${today.salvationLate} past 24 hours` : ""}
          </p>
        </article>
        {today.teamOpen !== null ? (
          <article className="desk-card">
            <h3>Whole care team</h3>
            <p className="count">{today.teamOpen}</p>
            <p className="help">
              open · {today.teamOverdue} overdue · {today.unassigned} with nobody yet
            </p>
          </article>
        ) : null}
      </div>
      <p className="muted">
        {today.activePlaybooks.length > 0
          ? `Playbooks on: ${today.activePlaybooks.join(", ")}.`
          : "Every playbook is off. A pastor or Master Admin can turn one on under Playbooks."}{" "}
        Nothing here sends a message.
      </p>
      <Link className="button" href="/tasks">
        Open My tasks
      </Link>
    </section>
  );
}

const GROUPS: { id: Task["bucket"]; title: string }[] = [
  { id: "overdue", title: "Overdue" },
  { id: "today", title: "Today" },
  { id: "week", title: "This week" },
  { id: "later", title: "Later" },
];

export function TaskCard({
  task,
  back,
  seats,
}: {
  task: Task;
  back: string;
  seats?: { id: string; displayName: string }[];
}) {
  return (
    <article
      className={task.overdue ? "panel task late" : "panel task"}
      aria-label={`${task.title} for ${task.name}`}
    >
      <h3>
        {task.personId ? (
          <Link href={`/person/${encodeURIComponent(task.personId)}`}>{task.name}</Link>
        ) : (
          task.name
        )}
        {" · "}
        {task.title}
      </h3>
      <p className="muted">
        {task.why} · {task.channelLabel} · due {formatChicago(task.dueAt)}
        {task.overdue ? " · overdue" : ""}
        {task.attempts > 0 ? ` · tried ${task.attempts}x` : ""}
        {seats ? ` · ${task.assigneeName}` : ""}
      </p>
      <p className="muted">
        {task.consent
          ? task.contactLocked
            ? "Confirm it's you again to see their phone and email."
            : `${task.phone || "No phone"} · ${task.email || "No email"}`
          : "They did not ask to be contacted. Pray for them; wait for them to reach out."}
      </p>
      {task.script ? (
        <details>
          <summary>Suggested words</summary>
          <p className="script">{task.script}</p>
          <CopyButton value={task.script} label="Copy the words" />
          <p className="help">This is only a suggestion. Nothing is sent for you.</p>
        </details>
      ) : null}
      <form className="form" action={completeTaskAction}>
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="back" value={back} />
        <label>
          How did it go? (optional)
          <input name="note" maxLength={2000} placeholder="A short note for the next person" />
        </label>
        <div className="template-row">
          <button className="button" type="submit" name="outcome" value="done">
            Done
          </button>
          <button className="button secondary" type="submit" name="outcome" value="unreached">
            Couldn&apos;t reach
          </button>
          <button className="button secondary" type="submit" name="outcome" value="skipped">
            Skip
          </button>
        </div>
      </form>
      {seats && seats.length > 0 ? (
        <form className="form" action={reassignTaskAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="back" value={back} />
          <label>
            Care team seat
            <select name="assigneeId" defaultValue={task.assigneeId ?? ""}>
              <option value="" disabled>
                Choose someone
              </option>
              {seats.map((seat) => (
                <option key={seat.id} value={seat.id}>
                  {seat.displayName}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary" type="submit">
            Move task
          </button>
        </form>
      ) : null}
    </article>
  );
}

export function TasksDesk({ store, token, query }: { store: ChurchStore; token: string; query: Query }) {
  const wantsTeam = one(query, "team") === "1";
  let data: ReturnType<ChurchStore["careTasksFor"]>;
  try {
    data = store.careTasksFor(token, { team: wantsTeam });
  } catch {
    return (
      <section>
        <h1>My tasks</h1>
        <p>Care tasks go to care team seats. Pastors can see the whole team.</p>
      </section>
    );
  }
  const notice = peopleNotice(query);
  const back = data.team ? "/tasks?team=1" : "/tasks";
  return (
    <section>
      <h1>{data.team ? "Whole care team" : "My tasks"}</h1>
      <p className="help">
        Each task is one person to reach. Copy the suggested words, call or text from your own phone, then tap
        Done. Couldn&apos;t reach puts it back for tomorrow (three tries). Nothing is sent from this screen.
      </p>
      {notice ? (
        <p
          className={notice.tone === "error" ? "notice error" : "notice"}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}
      {data.mayViewTeam ? (
        <div className="template-row">
          <Link className={data.team ? "button secondary" : "button"} href="/tasks">
            Mine
          </Link>
          <Link className={data.team ? "button" : "button secondary"} href="/tasks?team=1">
            Whole team
          </Link>
        </div>
      ) : null}
      {data.tasks.length === 0 ? (
        <p>
          Nothing to do right now. When a pastor or Master Admin turns on a playbook under Playbooks, new next steps from the
          app show up here.
        </p>
      ) : null}
      {GROUPS.map((group) => {
        const tasks = data.tasks.filter((task) => task.bucket === group.id);
        if (tasks.length === 0) return null;
        return (
          <div key={group.id}>
            <h2>
              {group.title} ({tasks.length})
            </h2>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                back={back}
                seats={data.team ? data.careSeats : undefined}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}

export function PlaybooksDesk({ store, token, query }: { store: ChurchStore; token: string; query: Query }) {
  let data: ReturnType<ChurchStore["playbooks"]>;
  try {
    data = store.playbooks(token);
  } catch {
    return (
      <section>
        <h1>Playbooks</h1>
        <p>Playbooks are for pastors and Master Admin.</p>
      </section>
    );
  }
  const notice = peopleNotice(query);
  return (
    <section>
      <h1>Playbooks</h1>
      <p className="help">
        A playbook turns a next step from the app into a short list of tasks for the care team. Every playbook
        starts off. {data.mayToggle ? "You can turn one on or off." : "Only a pastor or Master Admin can turn one on or off."}{" "}
        Turning one on affects new next steps only. Nothing is ever texted or emailed for you; the words are
        suggestions.
      </p>
      {data.careSeats === 0 ? (
        <p className="notice">
          There is no care team seat yet, so tasks would have nobody to go to. Give someone the Care team role
          first.
        </p>
      ) : null}
      {notice ? (
        <p
          className={notice.tone === "error" ? "notice error" : "notice"}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}
      {data.playbooks.map((playbook) => (
        <article className="panel" key={playbook.id} aria-label={playbook.name}>
          <h2>
            {playbook.name} · {playbook.active ? "On" : "Off"}
          </h2>
          <p>{playbook.summary}</p>
          {playbook.updatedAt ? (
            <p className="muted">
              Last changed by {playbook.updatedBy || "a pastor or Master Admin"} on {formatChicago(playbook.updatedAt)}
            </p>
          ) : null}
          <ol className="timeline">
            {playbook.steps.map((step, index) => (
              <li key={index}>
                <time>{step.when}</time>
                <p>
                  <strong>{step.title}</strong> · {step.channel} · care team
                </p>
                <p className="muted">{step.script}</p>
              </li>
            ))}
          </ol>
          {data.mayToggle ? (
            <form action={togglePlaybookAction}>
              <input type="hidden" name="playbookId" value={playbook.id} />
              <input type="hidden" name="active" value={playbook.active ? "off" : "on"} />
              <button className={playbook.active ? "button secondary" : "button"} type="submit">
                {playbook.active ? `Turn off ${playbook.name}` : `Turn on ${playbook.name}`}
              </button>
            </form>
          ) : null}
        </article>
      ))}
      <p className="muted">
        If someone did not ask to be contacted, the only task is to pray for them. Tasks go only to care team
        seats.
      </p>
    </section>
  );
}
