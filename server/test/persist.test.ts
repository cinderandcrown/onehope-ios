import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.ts";
import { ChurchStore } from "../src/store.ts";

test("a demo snapshot round-trips a member session without plaintext medical data", () => {
  const original = new ChurchStore(loadConfig({}));
  const session = original.login({
    email: "avery@sample.onehope",
    password: "hope-sample",
    ip: "test",
    userAgent: "test",
  });
  const document = original.toDocument();
  const encoded = JSON.stringify(document);
  const visible = JSON.stringify({
    ...document,
    children: document.children.map((child) => ({ ...child, ciphertext: "" })),
    notes: document.notes.map((note) => ({ ...note, ciphertext: "" })),
  });
  assert.equal(visible.includes("peanut"), false);
  assert.equal(visible.includes("4821"), false);
  assert.equal(encoded.includes("hope-sample"), false);
  const copy = new ChurchStore(loadConfig({}));
  const parsed: unknown = JSON.parse(encoded);
  assert.equal(typeof parsed === "object" && parsed !== null && "version" in parsed, true);
  copy.installDocument(parsed as ReturnType<ChurchStore["toDocument"]>);
  assert.equal(copy.me(session.token).displayName, "Avery Sample");
  const kids = copy.myKids(session.token);
  assert.equal(
    kids.some((child) => child.displayName === "Remy Sample"),
    true,
  );
  assert.equal(
    kids.some((child) => child.displayName === "Quinn Sample"),
    false,
  );
});
