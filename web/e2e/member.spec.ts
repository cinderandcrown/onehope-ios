import { expect, test } from "@playwright/test";

test("a member can sign in, act, and see a clear password error", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const takeover = await page.request.post("/api/auth/signup", {
    data: {
      email: "nicholas.will@cinderandcrown.com",
      password: "gathering",
      displayName: "Not Nicholas",
    },
  });
  expect(takeover.status()).toBe(400);
  expect(await takeover.text()).not.toContain("already exists");
  const seats = await page.request.get("/api/security/seats");
  expect(seats.status()).toBe(401);
  const stamp = Date.now();
  const email = `member${stamp}@onehope.test`;
  await page.goto("/member");
  await page.getByLabel("Email").nth(1).fill(email);
  await page.locator("form").nth(1).getByLabel("Password").fill("gathering");
  await page.locator("form").nth(1).getByLabel("Name").fill("Member Test");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  await page.getByRole("tab", { name: "Give" }).click();
  await expect(page.getByText("Giving opens soon.")).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveCount(0);
  await expect(page.getByText("Demo mode")).toHaveCount(0);

  await page.getByRole("tab", { name: "Watch" }).click();
  await expect(page.getByText("Sample")).toHaveCount(0);

  await page.getByRole("tab", { name: "Connect" }).click();
  await page.getByRole("button", { name: "Join" }).first().click();
  await expect(page.getByText("You're in that group.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Send to / })).toBeVisible();
  await page.getByRole("button", { name: /Send to / }).click();
  await expect(page.getByText("Write a note before sending it.")).toBeVisible();
  await page.locator("textarea").nth(0).fill("Glad to be here.");
  await page.getByRole("button", { name: /Send to / }).click();
  await expect(page.getByText("Your note was sent.")).toBeVisible();
  await page.getByRole("button", { name: "Register" }).first().click();
  await expect(page.getByText("You're registered.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Registered" }).first()).toBeVisible();
  const href = await page.getByRole("link", { name: "Add to calendar" }).first().getAttribute("href");
  await page.getByRole("tab", { name: "Home" }).click();
  await expect(page.getByText("You're registered.")).toHaveCount(0);
  await page.getByRole("tab", { name: "Connect" }).click();
  const ics = await page.request.get(href ?? "");
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("BEGIN:VCALENDAR");
  await page.getByRole("button", { name: "Share a prayer" }).click();
  await expect(page.getByText("Write a prayer before sharing it.")).toBeVisible();
  await page.locator("textarea").nth(1).fill("Pray for Richardson.");
  await page.getByRole("button", { name: "Share a prayer" }).click();
  await expect(page.getByText("Waiting for pastor approval")).toBeVisible();
  await page.getByPlaceholder("Child's name").fill("QA Child");
  await page.getByRole("button", { name: "Add child" }).click();
  await expect(page.getByText("QA Child was added.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check in" })).toBeVisible();
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText(/Security code \d{4}/)).toBeVisible();

  await page.getByRole("tab", { name: "More" }).click();
  await page.getByLabel("List me in the directory").check();
  await page.getByRole("button", { name: "Save privacy" }).click();
  await expect(page.getByText("Your privacy settings were saved.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
});
