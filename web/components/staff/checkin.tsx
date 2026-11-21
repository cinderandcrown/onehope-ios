import Link from "next/link";
import type { ChurchStore } from "@onehope/server";

import { confirmStepUpAction, clockInAction, clockOutAction, staffCheckInAction, stationPickupAction } from "@/app/staff-actions";
import { CopyButton, PrintButton } from "@/components/staff/clipboard";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function CheckInDesk({
  store,
  token,
  query,
}: {
  store: ChurchStore;
  token: string;
  query: Record<string, string | string[] | undefined>;
}) {
  let board: ReturnType<ChurchStore["stationBoard"]>;
  try {
    board = store.stationBoard(token, one(query, "room") || null);
  } catch {
    return (
      <section>
        <h1>Check-in</h1>
        <p>This desk is for the kids team. Ask a pastor if you need access.</p>
      </section>
    );
  }
  const labelId = one(query, "label");
  const label = labelId ? safeLabel(store, token, labelId) : null;
  const pickupNote = one(query, "pickup");
  const saved = one(query, "saved");
  const ready = board.adultsOnDuty >= 2;
  return (
    <section>
      <h1>Kids check-in</h1>
      <p className="help">
        How do I check a child in? Clock in, find the child, and tap Check in. Read the 4-digit code to the
        adult at the desk, or print the label. We never text the family. Pickup needs the code, an allowed
        adult, and two adults on duty.
      </p>
      {saved ? <p className="notice">Saved. The child is with their adult.</p> : null}
      {pickupNote ? <p className="notice">{pickupNote}</p> : null}
      <article className={ready ? "panel" : "panel duty-wait"}>
        <h2>{ready ? "Two adults are on duty" : `${board.adultsOnDuty} of 2 adults on duty`}</h2>
        <p>
          {board.namesOnDuty.length === 0
            ? "No one is clocked in yet."
            : `On duty: ${board.namesOnDuty.join(", ")}.`}
        </p>
        <p>{ready ? "Pickup can happen." : "Pickup stays closed until a second adult clocks in."}</p>
        <form action={board.onDuty ? clockOutAction : clockInAction}>
          <button className="button" type="submit">
            {board.onDuty ? "Clock out" : "Clock in"}
          </button>
        </form>
        <ConfirmInline />
      </article>
      <div className="template-row">
        <Link className="button secondary" href="/checkin">
          All rooms
        </Link>
        {board.classrooms.map((room) => (
          <Link className="button secondary" key={room} href={`/checkin?room=${encodeURIComponent(room)}`}>
            {room}
          </Link>
        ))}
      </div>
      {board.children.length === 0 ? (
        <p>No children in this room yet. Families add children from the app, then they show up here.</p>
      ) : (
        board.children.map((child) => (
          <article className="panel" key={child.id} id={`child-${child.id}`}>
            <h2>{child.displayName}</h2>
            <p>
              {child.classroom} · {child.checkedIn ? "Checked in" : "Not here yet"}
            </p>
            {child.checkedIn ? (
              <div className="nametag" id={label?.displayName === child.displayName ? "label" : undefined}>
                <p>One Hope Kids</p>
                <h3>{child.displayName}</h3>
                <p className="code">{child.code}</p>
                <p>{child.classroom}</p>
                <div className="template-row no-print">
                  <CopyButton value={child.code} label="Copy code" />
                  <PrintButton label="Print label" />
                </div>
              </div>
            ) : (
              <form action={staffCheckInAction}>
                <input type="hidden" name="childId" value={child.id} />
                <button className="button" type="submit">
                  Check in
                </button>
              </form>
            )}
            {child.checkedIn ? <PickupForm child={child} /> : null}
          </article>
        ))
      )}
        <p className="help">Allergies and medical notes stay off this screen. A leader can open them after confirming it is them.</p>
    </section>
  );
}

function safeLabel(store: ChurchStore, token: string, childId: string) {
  try {
    return store.stationLabel(token, childId);
  } catch {
    return null;
  }
}

function PickupForm({
  child,
}: {
  child: ReturnType<ChurchStore["stationBoard"]>["children"][number];
}) {
  const allowed = child.guardians.filter((adult) => !adult.blocked);
  const blocked = child.guardians.filter((adult) => adult.blocked);
  return (
    <form className="form" action={stationPickupAction}>
      <h3>Pickup</h3>
      <input type="hidden" name="childId" value={child.id} />
      {allowed.length === 0 ? (
        <p>No allowed adult is on file. See a kids leader before releasing this child.</p>
      ) : (
        <label>
          Who is picking up
          <select name="guardianPersonId" required defaultValue={allowed[0]?.id}>
            {allowed.map((adult) => (
              <option key={adult.id} value={adult.id}>
                {adult.displayName}
              </option>
            ))}
          </select>
        </label>
      )}
      {blocked.length > 0 ? (
        <p>Cannot pick up: {blocked.map((adult) => adult.displayName).join(", ")}.</p>
      ) : null}
      <label>
        Security code
        <input name="code" inputMode="numeric" pattern="\d{4}" required placeholder="4 digits" />
      </label>
      <p className="muted">
        If this asks you to confirm it is you, enter your authenticator code below first.
      </p>
      <button className="button" type="submit" disabled={allowed.length === 0}>
        Release child
      </button>
    </form>
  );
}

function ConfirmInline() {
  return (
    <form className="form" action={confirmStepUpAction}>
      <input type="hidden" name="next" value="/checkin" />
      <label>
        Confirm it is you (6-digit code)
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" />
      </label>
      <button className="button secondary" type="submit">
        Confirm it is me
      </button>
    </form>
  );
}
