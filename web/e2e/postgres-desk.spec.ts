import { expect, test } from "@playwright/test";

const desks = [
  ["/overview", "Sunday at 10:30"],
  ["/communications", "Home cards"],
  ["/events", "Events"],
  ["/care", "Care"],
  ["/checkin", "Kids check-in"],
  ["/serving", "Serving"],
  ["/media", "This Sunday message"],
  ["/people", "People"],
  ["/push", "Push"],
  ["/security", "Roles"],
  ["/admin", "Admin"],
] as const;

test("sample pastor stays signed in on Postgres and can use each desk", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /sample pastor/i }).click();
  await expect(page.getByRole("heading", { name: "Sunday at 10:30", level: 1 })).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);

  for (const [path, heading] of desks) {
    const response = await page.goto(path);
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }

  await page.goto("/communications");
  await page.getByRole("button", { name: /Post “/ }).first().click();
  await expect(page.getByText("Saved. Home updates the next time someone opens the app.")).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
});
