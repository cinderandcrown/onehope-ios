import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const shots = process.env.SCREENSHOT_DIR ?? "test-results/screenshots";

test("sample pastor can walk the command center without sending or charging", async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "One Hope" })).toBeVisible();
  await page.getByRole("button", { name: /sample pastor/i }).click();
  await expect(page.getByRole("heading", { name: "Sunday at 10:30" })).toBeVisible();
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
  await expect(page.getByText("The send endpoint refuses")).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/saved=1/);

  await page.goto("/people");
  await expect(page.getByRole("cell", { name: "Hidden" }).first()).toBeVisible();
  await page.screenshot({ path: `${shots}/command-people.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: "Sunday at 10:30" })).toBeVisible();
  await page.screenshot({ path: `${shots}/command-overview-mobile.png`, fullPage: true });
});
