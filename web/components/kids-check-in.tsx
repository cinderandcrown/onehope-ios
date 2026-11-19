"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Notify = (message: string) => void;

export type KidView = { id: string; displayName: string; classroom: string; checkedIn: boolean };

const CLASSROOMS = ["Nursery", "Preschool", "Elementary"];

async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    code?: string;
    allowed?: boolean;
    reason?: string;
    error?: string;
  };
  return { ok: response.ok, data };
}

/**
 * Household check-in. The security code shows once, on this screen, and works
 * once: pickup needs a verified guardian, two adults on duty, and that code.
 */
export function KidsCheckIn({ kids, onNotice }: { kids: KidView[]; onNotice: Notify }) {
  const router = useRouter();
  const [childName, setChildName] = useState("");
  const [classroom, setClassroom] = useState("Preschool");
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [entered, setEntered] = useState<Record<string, string>>({});
  async function addChild() {
    const displayName = childName.trim();
    if (!displayName) {
      onNotice("Enter your child's name.");
      return;
    }
    const { ok, data } = await post("/api/household/children", { displayName, classroom });
    onNotice(ok ? `${displayName} was added.` : data.error || "That didn't go through. Please try again.");
    if (ok) {
      setChildName("");
      router.refresh();
    }
  }
  async function checkIn(child: KidView) {
    const { ok, data } = await post("/api/kids/check-in", { childId: child.id });
    if (!ok || !data.code) {
      onNotice(data.error || "Check-in didn't go through.");
      return;
    }
    setCodes((current) => ({ ...current, [child.id]: data.code ?? "" }));
    onNotice(`${child.displayName} is checked in. Keep code ${data.code} for pickup.`);
    router.refresh();
  }
  async function pickUp(child: KidView) {
    const code = (entered[child.id] ?? "").trim();
    if (!/^\d{4}$/.test(code)) {
      onNotice("Enter the 4-digit security code from check-in.");
      return;
    }
    const { ok, data } = await post("/api/kids/household-pickup", { childId: child.id, code });
    if (!ok) {
      onNotice(data.error || "Pickup didn't go through.");
      return;
    }
    onNotice(data.allowed ? `${child.displayName} is picked up. ${data.reason ?? ""}` : (data.reason ?? ""));
    if (data.allowed) {
      setCodes(({ [child.id]: _used, ...rest }) => rest);
      setEntered(({ [child.id]: _typed, ...rest }) => rest);
      router.refresh();
    }
  }
  return (
    <section>
      <h2>Kids check-in</h2>
      {kids.map((child) => (
        <article className="card" key={child.id}>
          <h3>{child.displayName}</h3>
          <p>
            {child.classroom} ·{" "}
            {child.checkedIn ? <span className="badge">Checked in</span> : "Not checked in"}
          </p>
          {codes[child.id] ? (
            <p className="security-code" aria-label="Security code">
              Security code <strong>{codes[child.id]}</strong>
            </p>
          ) : null}
          {child.checkedIn ? (
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                void pickUp(child);
              }}
            >
              <label>
                Security code for pickup
                <input
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={entered[child.id] ?? ""}
                  onChange={(event) =>
                    setEntered((current) => ({ ...current, [child.id]: event.target.value }))
                  }
                />
              </label>
              <button className="button" type="submit">
                Pick up {child.displayName}
              </button>
            </form>
          ) : (
            <button type="button" className="button" onClick={() => void checkIn(child)}>
              Check in
            </button>
          )}
        </article>
      ))}
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          void addChild();
        }}
      >
        <input
          value={childName}
          onChange={(event) => setChildName(event.target.value)}
          placeholder="Child's name"
        />
        <select value={classroom} onChange={(event) => setClassroom(event.target.value)}>
          {CLASSROOMS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <button type="submit" className="button secondary">
          Add child
        </button>
      </form>
    </section>
  );
}
