import { ChurchImage } from "@/components/church-image";
import { AnnouncementsDesk } from "@/components/staff/announcements";
import { CareDesk } from "@/components/staff/care";
import { CheckInDesk } from "@/components/staff/checkin";
import { EventsDesk } from "@/components/staff/events";
import { PeopleDesk } from "@/components/staff/people";

import {
  createGroupAction,
  savePush,
  saveSocialAction,
} from "@/app/actions";
import type { SectionId } from "@/lib/i18n";
import {
  AccessError,
  CAPABILITIES,
  labelRole,
  permissionMatrix,
  withStore,
  type ChurchStore,
} from "@onehope/server";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function Desk({ store, token }: { store: ChurchStore; token: string }) {
  let desk: ReturnType<ChurchStore["staffHome"]> | null = null;
  try {
    desk = store.staffHome(token);
  } catch {
    desk = null;
  }
  if (!desk) return null;
  return (
    <section>
      <h2>{desk.greeting}</h2>
      <div className="desk-grid">
        {desk.cards.map((card) => (
          <article className="desk-card" key={card.id}>
            <h3>{card.title}</h3>
            {card.count === null ? null : <p className="count">{card.count}</p>}
            <p>{card.detail}</p>
            <p className="help">{card.help}</p>
            <a className="desk-open" href={card.href}>
              Open
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function Locked({ title }: { title: string }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p>Confirm it is you again before this opens.</p>
    </section>
  );
}

function giftsOf(store: ChurchStore, token: string) {
  try {
    return { locked: false as const, gifts: store.allGifts(token) };
  } catch (error) {
    if (error instanceof AccessError && (error.code === "step_up_required" || error.code === "forbidden")) {
      return { locked: true as const, gifts: [] };
    }
    throw error;
  }
}

export async function SectionView({
  section,
  token,
  query,
}: {
  section: SectionId;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  return withStore((store) => renderSection(store, section, token, query));
}

function renderSection(
  store: ChurchStore,
  section: SectionId,
  token: string,
  query: Record<string, string | string[] | undefined>,
) {
  switch (section) {
    case "overview": {
      const home = store.publicHome();
      const seats = store.seats();
      return (
        <>
          <Desk store={store} token={token} />
          <section className="hero">
            <div>
              <p className="muted">{home.church.address}</p>
              <h1>Sunday at 10:30</h1>
              <p>Pre-service coffee at 10:00 a.m. Lead pastors {home.church.leadPastors.join(" and ")}.</p>
              <p>
                Next gathering{" "}
                {new Date(home.countdown.service).toLocaleString("en-US", { timeZone: home.church.timeZone })}
                .
              </p>
            </div>
            <ChurchImage src={home.images.hero} alt="" />
          </section>
          <div className="grid" style={{ marginTop: "1rem" }}>
            <article className="card">
              <h2>Master Admin seats</h2>
              <p>
                {seats.primary.name} · {seats.primary.filled ? "seated" : "open"}
              </p>
              <p>
                {seats.secondary.name || "Lead Pastor"} ·{" "}
                {seats.secondary.filled ? "seated" : "email not set"}
              </p>
            </article>
            <article className="card">
              <h2>Modules</h2>
              <p>{store.modules().filter((item) => item.enabled).length} on for this church.</p>
            </article>
            {home.sampleSermon.title ? (
              <article className="card">
                <h2>Latest message</h2>
                <p>{home.sampleSermon.title}</p>
              </article>
            ) : null}
          </div>
          <article className="panel">
            <h2>Follow along</h2>
            <p className="help">
              How do I change a link? Edit the row and save. Only https links. These show on Today, Connect,
              and the public invite page.
            </p>
            <form className="form social-editor" action={saveSocialAction}>
              {store.socialLinks().map((link) => (
                <label key={link.id}>
                  <span>{link.name}</span>
                  <input type="hidden" name="id" value={link.id} />
                  <input type="hidden" name="name" value={link.name} />
                  <input
                    name="url"
                    type="url"
                    defaultValue={link.url}
                    aria-label={`${link.name} address`}
                    required
                  />
                </label>
              ))}
              <button className="button" type="submit">
                Save links
              </button>
            </form>
          </article>
        </>
      );
    }
    case "people":
      return <PeopleDesk store={store} token={token} query={query} />;
    case "discipleship": {
      const ministry = store.ministry(token);
      const rows = ministry.pathwayRoster.length > 0 ? ministry.pathwayRoster : [ministry.pathways];
      return (
        <section>
          <h1>Next steps</h1>
          {rows.map((person) => (
            <article className="card" key={person.personId}>
              <h2>{person.displayName}</h2>
              <p>{person.steps.map((step) => `${step.title}: ${step.status}`).join(" · ")}</p>
            </article>
          ))}
        </section>
      );
    }
    case "care":
      return <CareDesk store={store} token={token} query={query} />;
    case "groups": {
      return (
        <section>
          <h1>Groups</h1>
          <form className="form" action={createGroupAction}>
            <input name="name" placeholder="Group name" required />
            <input name="summary" placeholder="Summary" required />
            <button className="button" type="submit">
              Add group
            </button>
          </form>
          {store.listGroups(token).map((group) => (
            <article className="card" key={group.id}>
              <h2>{group.name}</h2>
              <p>{[group.schedule, group.summary].filter(Boolean).join(" · ")}</p>
              {group.leaders.length > 0 ? <p>Led by {group.leaders.join(", ")}</p> : null}
              <p className="help">
                Who is in it:{" "}
                {store
                  .groupRoster(token, group.id)
                  .people.map((person) => person.displayName)
                  .join(", ") || "No one has joined yet."}
              </p>
              {group.url ? (
                <a href={group.url} target="_blank" rel="noreferrer">
                  {group.joinType === "request" ? "Requests on Church Center" : "Church Center page"}
                </a>
              ) : null}
            </article>
          ))}
        </section>
      );
    }
    case "events":
      return <EventsDesk store={store} token={token} query={query} />;
    case "checkin":
      return <CheckInDesk store={store} token={token} query={query} />;
    case "serving": {
      const rows = store.serving(token);
      return (
        <section>
          <h1>Serving</h1>
          {rows.length === 0 ? (
            <p>No assignments on your list.</p>
          ) : (
            rows.map((row) => (
              <article className="card" key={row.id}>
                <h2>{row.position}</h2>
                <p>
                  {row.displayName} · {row.status}
                </p>
              </article>
            ))
          )}
          <p>
            Suggested greeter:{" "}
            {store
              .suggestSchedule()
              .assignments.map((item) => item.personId)
              .join(", ") || "none"}{" "}
          </p>
        </section>
      );
    }
    case "worship": {
      const plan = store.ministry(token).worship.plans[0];
      return (
        <section>
          <h1>Worship</h1>
          {plan ? (
            <article className="card">
              <h2>{plan.title}</h2>
              <p>{plan.items.join(" · ")}</p>
              <p>
                {plan.songs
                  .map((song) => `${song.title} · CCLI ${song.ccliNumber ?? "not entered"}`)
                  .join(", ")}
              </p>
              <p>No lyrics are stored.</p>
            </article>
          ) : (
            <p>No plan.</p>
          )}
        </section>
      );
    }
    case "kids": {
      const lessons = store.ministry(token).curriculum;
      return (
        <section>
          <h1>Kids and students</h1>
          <ChurchImage className="photo" src={store.churchImages().hero} alt="" />
          {lessons.map((lesson) => (
            <article className="card" key={lesson.id}>
              <h2>{lesson.title}</h2>
              <p>{lesson.ages}</p>
            </article>
          ))}
          <p>Allergies, medical notes, and custody flags stay on the check-in record and require step-up.</p>
        </section>
      );
    }
    case "communications":
      return (
        <>
          <AnnouncementsDesk store={store} token={token} query={query} />
          <article className="panel">
            <h2>Email and text</h2>
            <p>
              This screen does not email or text anyone. Home cards are the note people see when they open
              the app.
            </p>
          </article>
        </>
      );
    case "push":
      return (
        <section>
          <h1>Push</h1>
          <p>Preview only. The send endpoint refuses, even for a Master Admin.</p>
          <form className="form" action={savePush}>
            <label>
              Title
              <input name="title" required maxLength={80} defaultValue="Sunday at 10:30" />
            </label>
            <label>
              Body
              <textarea name="body" required maxLength={240} defaultValue="Sunday at 10:30 a.m." />
            </label>
            <label>
              Segment
              <select name="segment" defaultValue="members">
                <option value="members">Members</option>
                <option value="volunteers">Volunteers</option>
                <option value="parents">Parents</option>
              </select>
            </label>
            <button className="button" type="submit">
              Save draft
            </button>
          </form>
        </section>
      );
    case "facilities": {
      const facilities = store.ministry(token).facilities;
      return (
        <section>
          <h1>Rooms</h1>
          {facilities.rooms.map((room) => (
            <article className="card" key={room.id}>
              <h2>{room.name}</h2>
              <p>{room.campus}</p>
            </article>
          ))}
          <h2>Bookings</h2>
          {facilities.bookings.map((booking) => (
            <p key={booking.id}>
              {booking.roomId} ·{" "}
              {new Date(booking.start).toLocaleString("en-US", { timeZone: "America/Chicago" })}
            </p>
          ))}
        </section>
      );
    }
    case "giving": {
      const result = giftsOf(store, token);
      return (
        <section>
          <h1>Giving</h1>
          <p>
            Demo mode. Cards stay at Stripe. Nothing in this build is charged. Apple Pay nonprofit approval is
            pending.
          </p>
          {result.locked ? (
            <Locked title="Giving records" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fund</th>
                  <th>Amount</th>
                  <th>Charged</th>
                </tr>
              </thead>
              <tbody>
                {result.gifts.map((gift) => (
                  <tr key={gift.id}>
                    <td>{gift.fundName}</td>
                    <td>{money(gift.amountCents)}</td>
                    <td>{gift.charged ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      );
    }
    case "stewardship": {
      const finance = store.ministry(token).finance;
      return (
        <section>
          <h1>Stewardship</h1>
          {finance.locked ? (
            <Locked title="Stewardship" />
          ) : (
            <div className="grid">
              <article className="card">
                <h2>Visitors</h2>
                <p className="stat">{finance.funnel.visitors}</p>
              </article>
              <article className="card">
                <h2>Members</h2>
                <p className="stat">{finance.funnel.members}</p>
              </article>
              <article className="card">
                <h2>Givers</h2>
                <p className="stat">{finance.funnel.givers}</p>
              </article>
              <article className="card">
                <h2>Servers</h2>
                <p className="stat">{finance.funnel.servers}</p>
              </article>
            </div>
          )}
        </section>
      );
    }
    case "finance": {
      const finance = store.ministry(token).finance;
      return (
        <section>
          <h1>Finance</h1>
          {finance.locked ? (
            <Locked title="Budgets" />
          ) : (
            finance.budgets.map((budget) => (
              <article className="card" key={budget.id}>
                <h2>{budget.name}</h2>
                <p>
                  Budget {money(budget.budgetCents)} · Actual {money(budget.actualCents)}
                </p>
              </article>
            ))
          )}
          {finance.locked ? null : (
            <>
              <p>Download the giving CSV. It is not posted to a company file.</p>
              <pre>{store.quickbooksCsv(token).slice(0, 180)}</pre>
            </>
          )}
        </section>
      );
    }
    case "missions": {
      const missions = store.ministry(token).missions;
      return (
        <section>
          <h1>Missions</h1>
          {missions.partners.map((partner) => (
            <article className="card" key={partner.id}>
              <h2>{partner.name}</h2>
              <p>{partner.summary}</p>
            </article>
          ))}
          {missions.trips.map((trip) => (
            <article className="card" key={trip.id}>
              <h2>{trip.name}</h2>
              <p>
                Raised {money(trip.raisedCents)} of {money(trip.goalCents)}
              </p>
            </article>
          ))}
        </section>
      );
    }
    case "media": {
      const media = store.ministry(token).media;
      return (
        <section className="hero">
          <ChurchImage src={store.churchImages().video} alt="" />
          <div>
            <h1>Media</h1>
            {media.series.map((series) => (
              <p key={series.id}>{series.title}</p>
            ))}
            {media.chat.map((line) => (
              <p key={line.id}>{line.body}</p>
            ))}
            <p>
              YouTube uses the public RSS feed. Facebook Live stays a placeholder until a Page token is set.
            </p>
          </div>
        </section>
      );
    }
    case "integrations": {
      const rows = store.integrations(token);
      return (
        <section>
          <h1>Integrations</h1>
          <p>
            Keys live on the server, encrypted. This page never shows the secret. Live calls stay off until
            the env var for that provider is set.
          </p>
          {rows.length === 0 ? (
            <p>No key has been stored.</p>
          ) : (
            rows.map((row) => (
              <p key={row.provider}>
                {row.provider} · configured · {row.last4 ? `ending ${row.last4}` : "last digits hidden"}
              </p>
            ))
          )}
        </section>
      );
    }
    case "capabilities":
      return (
        <section>
          <h1>Capability matrix</h1>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Product</th>
                <th>Read</th>
                <th>Write</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((row) => (
                <tr key={`${row.provider}-${row.product}`}>
                  <td>{row.provider}</td>
                  <td>
                    {row.product}
                    <br />
                    <span className="muted">{row.notes}</span>
                  </td>
                  <td className={row.read ? "yes" : "no"}>{row.read ? "Yes" : "No"}</td>
                  <td className={row.write ? "yes" : "no"}>{row.write ? "Yes" : "No"}</td>
                  <td>
                    {row.status === "live" ? "Live" : row.status === "dry_run" ? "Dry run" : "Not built"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );
    case "security": {
      const seats = store.seats();
      const matrix = permissionMatrix();
      const columns = [
        "view_all_giving",
        "view_care_notes",
        "view_kids_medical",
        "manage_integrations",
        "propose_master_admin",
      ] as const;
      return (
        <section>
          <h1>Roles</h1>
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
            <p>
              Changing this role takes both current Master Admins. Every Tier 3 read is logged, including
              theirs, and still needs MFA plus step-up.
            </p>
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
    case "admin": {
      const status = store.status("1.0.0");
      const audit = store.audit(token).slice(-8);
      return (
        <section>
          <h1>Admin</h1>
          <p>
            Encryption key mode: {status.fieldEncryption}. Giving live: {status.givingLive ? "yes" : "no"}.
            Sends: off.
          </p>
          <h2>Recent audit</h2>
          {audit.length === 0 ? (
            <p>No audit rows yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Tier</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.actorId}</td>
                    <td>{entry.action}</td>
                    <td>{entry.resource}</td>
                    <td>{entry.tier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h2>Attendance</h2>
          {(() => {
            const attendance = store.ministry(token).attendance;
            return attendance.locked ? (
              <Locked title="Attendance" />
            ) : (
              attendance.headcounts.map((row) => (
                <p key={row.id}>
                  {row.label}: {row.count}
                </p>
              ))
            );
          })()}
        </section>
      );
    }
    default: {
      const unreachable: never = section;
      return unreachable;
    }
  }
}
