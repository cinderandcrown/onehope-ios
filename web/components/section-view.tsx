import Image from "next/image";

import { savePush } from "@/app/actions";
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

function Badge({ sample }: { sample: boolean }) {
  return sample ? <span className="badge">Sample</span> : null;
}

function Locked({ title }: { title: string }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p>
        Confirm it is you again before this opens. This sample pastor session is already stepped up; a normal
        staff session stops here.
      </p>
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

export async function SectionView({ section, token }: { section: SectionId; token: string }) {
  return withStore((store) => renderSection(store, section, token));
}

function renderSection(store: ChurchStore, section: SectionId, token: string) {
  switch (section) {
    case "overview": {
      const home = store.publicHome();
      const seats = store.seats();
      return (
        <>
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
            <Image
              src="/photos/hero.jpg"
              alt="A parent and child from the One Hope site"
              width={1400}
              height={816}
            />
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
            <article className="card">
              <h2>Sample sermon</h2>
              <p>
                <Badge sample /> {home.sampleSermon.title}
              </p>
            </article>
          </div>
        </>
      );
    }
    case "people": {
      const people = store.directory(token);
      return (
        <section>
          <h1>People</h1>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id}>
                  <td>
                    {person.displayName} <Badge sample />
                  </td>
                  <td>{person.email || "Hidden"}</td>
                  <td>{person.phone || "Hidden"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );
    }
    case "discipleship": {
      const ministry = store.ministry(token);
      const rows = ministry.pathwayRoster.length > 0 ? ministry.pathwayRoster : [ministry.pathways];
      return (
        <section>
          <h1>Next steps</h1>
          {rows.map((person) => (
            <article className="card" key={person.personId}>
              <h2>
                {person.displayName} <Badge sample />
              </h2>
              <p>{person.steps.map((step) => `${step.title}: ${step.status}`).join(" · ")}</p>
            </article>
          ))}
        </section>
      );
    }
    case "care": {
      const care = store.ministry(token).care;
      return (
        <section>
          <h1>Care</h1>
          {care.notes.length === 0 ? (
            <p>No care notes are visible to you.</p>
          ) : (
            care.notes.map((note) => (
              <article className="card" key={note.id}>
                <Badge sample />
                <p>{note.body}</p>
              </article>
            ))
          )}
          {care.queue.locked ? (
            <Locked title="Staff care queue" />
          ) : (
            <article className="panel">
              <h2>Follow-up</h2>
              {care.queue.visitors.map((visitor) => (
                <p key={visitor.id}>
                  {visitor.name} · {visitor.state} <Badge sample={visitor.sample} />
                </p>
              ))}
              {care.queue.requests.map((request) => (
                <p key={request.id}>
                  {request.kind}: {request.detail}
                </p>
              ))}
            </article>
          )}
        </section>
      );
    }
    case "groups": {
      return (
        <section>
          <h1>Groups</h1>
          {store.listGroups(token).map((group) => (
            <article className="card" key={group.id}>
              <h2>
                {group.name} <Badge sample={group.sample} />
              </h2>
              <p>{group.summary}</p>
              <p>{group.joined ? "Joined" : "Not joined"}</p>
            </article>
          ))}
        </section>
      );
    }
    case "events": {
      return (
        <section>
          <h1>Events</h1>
          {store.publicHome().events.map((event) => (
            <article className="card" key={event.id}>
              <h2>
                {event.title} <Badge sample={event.sample} />
              </h2>
              <p>{event.location}</p>
              <p>{event.capacity === null ? "Open" : `Capacity ${event.capacity}`}</p>
            </article>
          ))}
        </section>
      );
    }
    case "checkin": {
      const roster = store.roster(token);
      const label = store.label(token, "child-remy");
      return (
        <section>
          <h1>Check-in</h1>
          <p>
            Two adults on duty. Pickup matches the guardian and the security code, and stops for a custody
            flag.
          </p>
          <table>
            <thead>
              <tr>
                <th>Child</th>
                <th>Classroom</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((child) => (
                <tr key={child.id}>
                  <td>
                    {child.displayName} <Badge sample={child.sample} />
                  </td>
                  <td>{child.classroom}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Label handoff</h2>
          <p>
            Zebra receives ZPL. Brother receives the same fields. This screen does not open a printer socket.
          </p>
          <pre>{label.zpl}</pre>
        </section>
      );
    }
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
                  {row.displayName} · {row.status} <Badge sample={row.sample} />
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
            <Badge sample />
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
              <h2>
                {plan.title} <Badge sample />
              </h2>
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
          <Image
            className="photo"
            src="/photos/community1.jpg"
            alt="Children from the One Hope site"
            width={882}
            height={1246}
          />
          {lessons.map((lesson) => (
            <article className="card" key={lesson.id}>
              <h2>{lesson.title}</h2>
              <p>
                {lesson.ages} <Badge sample />
              </p>
            </article>
          ))}
          <p>Allergies, medical notes, and custody flags stay on the check-in record and require step-up.</p>
        </section>
      );
    }
    case "communications":
      return (
        <section>
          <h1>Communications</h1>
          <p>Email and SMS adapters exist. This build does not call them.</p>
          <article className="panel">
            <h2>Sent</h2>
            <p>No messages have been sent.</p>
          </article>
        </section>
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
              <textarea
                name="body"
                required
                maxLength={240}
                defaultValue="Sample reminder. This will not be delivered."
              />
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
              {booking.roomId} · {new Date(booking.start).toLocaleString()}
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
                    <td>
                      {gift.fundName} <Badge sample={gift.sample} />
                    </td>
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
                <Badge sample />
              </article>
              <article className="card">
                <h2>Members</h2>
                <p className="stat">{finance.funnel.members}</p>
                <Badge sample />
              </article>
              <article className="card">
                <h2>Givers</h2>
                <p className="stat">{finance.funnel.givers}</p>
                <Badge sample />
              </article>
              <article className="card">
                <h2>Servers</h2>
                <p className="stat">{finance.funnel.servers}</p>
                <Badge sample />
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
                <h2>
                  {budget.name} <Badge sample />
                </h2>
                <p>
                  Budget {money(budget.budgetCents)} · Actual {money(budget.actualCents)}
                </p>
              </article>
            ))
          )}
          {finance.locked ? null : (
            <>
              <p>QuickBooks download is a Sample CSV. It is not posted to a company file.</p>
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
              <p>
                {partner.summary} <Badge sample={partner.sample} />
              </p>
            </article>
          ))}
          {missions.trips.map((trip) => (
            <article className="card" key={trip.id}>
              <h2>
                {trip.name} <Badge sample />
              </h2>
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
          <Image src="/photos/video.jpg" alt="A gathering from the One Hope site" width={710} height={1026} />
          <div>
            <h1>Media</h1>
            {media.series.map((series) => (
              <p key={series.id}>
                {series.title} <Badge sample />
              </p>
            ))}
            {media.chat.map((line) => (
              <p key={line.id}>
                {line.body} <Badge sample />
              </p>
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
                  <td>{row.status === "enforced-demo" ? "Enforced demo" : "Scaffolded"}</td>
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
                  {row.label}: {row.count} <Badge sample />
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
