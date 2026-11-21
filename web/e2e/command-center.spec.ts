import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const shots = process.env.SCREENSHOT_DIR ?? "test-results/screenshots";

test("sample pastor can walk the command center without sending or charging", async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "One Hope" })).toBeVisible();
  await page.getByRole("button", { name: /sample pastor/i }).click();
  await expect(page.getByRole("heading", { name: "Sunday at 10:30", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This week on Home" })).toBeVisible();
  await expect(
    page.getByText("No message is featured yet. Open Media and tap Feature on Home.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Nicholas Will")).toBeVisible();
  await page.screenshot({ path: `${shots}/command-overview.png`, fullPage: true });

  await page.goto("/security");
  const firstRole = page.locator("table tbody tr").first();
  await expect(firstRole).toContainText("Master Admin");
  await expect(page.getByText("nicholas.will@cinderandcrown.com")).toBeVisible();
  await page.screenshot({ path: `${shots}/command-security.png`, fullPage: true });

  await page.goto("/giving");
  await expect(page.getByText("Nothing in this build is charged")).toBeVisible();
  await expect(page.getByRole("cell", { name: "$25.00" })).toBeVisible();
  await page.screenshot({ path: `${shots}/command-giving.png`, fullPage: true });

  await page.goto("/capabilities");
  await expect(page.getByRole("cell", { name: "Planning Center" }).first()).toBeVisible();
  await page.screenshot({ path: `${shots}/command-capabilities.png`, fullPage: true });

  await page.goto("/push");
  await expect(page.getByText("Nothing was sent. Apple push is not turned on")).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/saved=1/);
  await expect(page.getByText("Saved as a draft. Nothing was sent.")).toBeVisible();
  await page.screenshot({ path: `${shots}/command-push.png`, fullPage: true });

  await page.goto("/care");
  await expect(page.getByRole("heading", { name: "Next steps from the app" })).toBeVisible();
  await page.screenshot({ path: `${shots}/command-care.png`, fullPage: true });

  await page.goto("/people");
  await expect(page.getByRole("cell", { name: "Hidden" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Add someone" })).toBeVisible();
  await page.screenshot({ path: `${shots}/command-people.png`, fullPage: true });

  await page.goto("/communications");
  await expect(page.getByRole("heading", { name: "Home cards" })).toBeVisible();
  await page.screenshot({ path: `${shots}/command-announcements.png`, fullPage: true });

  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
  await expect(page.getByLabel("Starts (Central)").first()).toBeVisible();
  await page.screenshot({ path: `${shots}/command-events.png`, fullPage: true });

  await page.goto("/checkin");
  await expect(page.getByRole("heading", { name: "Kids check-in" })).toBeVisible();
  await expect(page.getByText("never text", { exact: false })).toBeVisible();
  await page.screenshot({ path: `${shots}/command-checkin.png`, fullPage: true });

  await page.goto("/serving");
  await expect(page.getByRole("heading", { name: "Serving" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask them to serve" })).toBeVisible();
  await page.screenshot({ path: `${shots}/command-serving.png`, fullPage: true });

  await page.goto("/media");
  await expect(page.getByRole("heading", { name: "This Sunday message" })).toBeVisible();
  await page.screenshot({ path: `${shots}/command-media.png`, fullPage: true });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download spreadsheet" })).toBeVisible();
  await page.screenshot({ path: `${shots}/command-admin.png`, fullPage: true });

  await page.goto("/claim");
  await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible();
  await page.screenshot({ path: `${shots}/command-claim.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: "Sunday at 10:30", level: 1 })).toBeVisible();
  await page.screenshot({ path: `${shots}/command-overview-mobile.png`, fullPage: true });
});

test("a member who signs in on the staff form is told the desk is for staff", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("avery@sample.onehope");
  await page.getByLabel("Password").fill("hope-sample");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/login\?error=member/);
  await expect(page.locator("p.error")).toContainText("This sign-in is for church staff");
  await expect(page.locator("p.error").getByRole("link")).toHaveAttribute("href", "/member");
  // The member session was ended, so the desk still sends them back to sign in.
  await page.goto("/overview");
  await expect(page).toHaveURL(/\/login/);
});

test("sign-in and member pages render when a church photo is configured", async ({ page }) => {
  const login = await page.goto("/login");
  expect(login?.status()).toBe(200);
  await expect(page.locator("img.login-photo")).toHaveAttribute(
    "src",
    "https://images.onehope.test/hero.jpg",
  );
  const member = await page.goto("/member");
  expect(member?.status()).toBe(200);
});

test("People: find someone, log a touch, tag them and set their stage", async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  await page.goto("/login");
  await page.getByRole("button", { name: /sample pastor/i }).click();
  await expect(page.getByRole("heading", { name: "Sunday at 10:30", level: 1 })).toBeVisible();

  await page.goto("/people");
  await expect(page.getByRole("heading", { name: "Everyone", level: 2 })).toBeVisible();
  await page.getByRole("searchbox").or(page.getByLabel("Search")).first().fill("casey");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page).toHaveURL(/q=casey/);
  const table = page.getByRole("table", { name: "People" });
  await expect(table.getByRole("link", { name: "Casey Sample" })).toBeVisible();
  await expect(table.getByRole("link", { name: "Avery Sample" })).toHaveCount(0);
  await page.screenshot({ path: `${shots}/people-search.png`, fullPage: true });

  await table.getByRole("link", { name: "Casey Sample" }).click();
  await expect(page.getByRole("heading", { name: "Casey Sample", level: 1 })).toBeVisible();
  await expect(page.getByText("No touches yet.")).toBeVisible();

  await page.getByLabel("Called").check();
  await page.getByLabel("How did it go?").selectOption("prayed");
  await page.getByLabel("Note (optional)").fill("Prayed for the new job.");
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.getByText("Logged. It is on their timeline now.")).toBeVisible();
  const timeline = page.getByRole("list", { name: "Timeline" });
  await expect(timeline).toContainText("Called");
  await expect(timeline).toContainText("Prayed together");
  await expect(timeline).toContainText("Prayed for the new job.");

  await page.getByLabel("Add a tag").selectOption({ label: "Greeters (sample)" });
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect(page.getByRole("list", { name: "Tags for Casey Sample" })).toContainText("Greeters (sample)");

  await page.getByLabel("Where are they on the path?").selectOption("returning");
  await page.getByRole("button", { name: "Save stage" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByText(/Coming back · Last contact/)).toBeVisible();
  await page.screenshot({ path: `${shots}/person-page.png`, fullPage: true });

  await page.getByRole("link", { name: "← All people" }).click();
  await page.getByLabel("Stage").selectOption("returning");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(
    page.getByRole("table", { name: "People" }).getByRole("link", { name: "Casey Sample" }),
  ).toBeVisible();
});

test("Care engine: a pastor turns on a playbook, a decision becomes a task, and Today counts it", async ({
  page,
  request,
}) => {
  mkdirSync(shots, { recursive: true });
  await page.goto("/login");
  await page.getByRole("button", { name: /sample pastor/i }).click();
  await expect(page.getByRole("heading", { name: "Sunday at 10:30", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today", level: 2 })).toBeVisible();

  await page.goto("/playbooks");
  const salvation = page.getByRole("article", { name: "Said yes to Jesus" });
  await expect(salvation.getByRole("heading", { name: "Said yes to Jesus · Off" })).toBeVisible();
  await expect(
    page.getByRole("article", { name: "First visit" }).getByRole("heading", { name: "First visit · Off" }),
  ).toBeVisible();
  await salvation.getByRole("button", { name: "Turn on Said yes to Jesus" }).click();
  await expect(page.getByText("Playbook is on.")).toBeVisible();
  await expect(salvation.getByRole("heading", { name: "Said yes to Jesus · On" })).toBeVisible();
  await page.screenshot({ path: `${shots}/playbooks.png`, fullPage: true });

  const sent = await request.post("/api/follow-ups", {
    data: { kind: "salvation", name: "Jordan E2E", phone: "214-555-0142", consent: true },
  });
  expect(sent.status()).toBe(200);

  await page.goto("/tasks?team=1");
  await expect(page.getByRole("heading", { name: "Whole care team", level: 1 })).toBeVisible();
  const call = page.getByRole("article", { name: "Celebrate and pray with them for Jordan E2E" });
  await expect(call).toBeVisible();
  await expect(call).toContainText("Said yes to Jesus, within 24 hours");
  await expect(call).toContainText("Eden Sample");
  await expect(call).toContainText("214-555-0142");
  await call.getByText("Suggested words").click();
  await expect(call).toContainText("Hi Jordan, this is Reese from One Hope Church.");
  await page.screenshot({ path: `${shots}/tasks-team.png`, fullPage: true });
  await call.getByLabel("How did it go? (optional)").fill("Prayed together on the phone.");
  await call.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Done. Thank you for reaching out.")).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Celebrate and pray with them for Jordan E2E" }),
  ).toHaveCount(0);

  await page.goto("/overview");
  const today = page.locator("section.today-card");
  await expect(today).toContainText("Decisions this week");
  await expect(today).toContainText("1 reached within 24 hours");
  await expect(today).toContainText("Playbooks on: Said yes to Jesus.");

  await page.goto("/playbooks");
  await page.getByRole("button", { name: "Turn off Said yes to Jesus" }).click();
  await expect(page.getByText("Playbook is off.")).toBeVisible();
});
