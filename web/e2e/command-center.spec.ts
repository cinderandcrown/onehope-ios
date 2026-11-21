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
