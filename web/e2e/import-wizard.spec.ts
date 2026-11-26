import { expect, test } from "@playwright/test";
import path from "node:path";

const csv = path.join(process.cwd(), "e2e/fixtures/guests.csv");

test.describe.configure({ mode: "serial" });

test("pastor imports a spreadsheet, then merges a duplicate and undoes both", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("button", { name: /sample pastor/i }).click();
  await expect(page.getByRole("heading", { name: "Sunday at 10:30", level: 1 })).toBeVisible();

  await page.goto("/import");
  await expect(page.getByRole("heading", { name: "Import people", level: 1 })).toBeVisible();
  await expect(page.getByText("one-time Planning Center")).toBeVisible();
  await page.getByLabel("Spreadsheet").setInputFiles(csv);
  await page.getByRole("button", { name: "Look at this file" }).click();

  await expect(page.getByRole("heading", { name: "Match the columns" })).toBeVisible();
  await expect(page.getByLabel("Match First Name")).toHaveValue("first_name");
  await expect(page.getByLabel("Match Email")).toHaveValue("email");
  await page.getByRole("button", { name: "Preview the first 10" }).click();

  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  const preview = page.getByRole("table", { name: "Preview" });
  await expect(preview).toContainText("Ada Hope");
  await expect(preview).toContainText("Possible duplicate");
  await page.getByRole("button", { name: "Import these people" }).click();

  await expect(page.getByRole("heading", { name: "Import summary" })).toBeVisible();
  const results = page.getByRole("list", { name: "Import results" });
  await expect(results).toContainText("Added 3");
  await expect(results).toContainText("Updated 0");
  await expect(results).toContainText("Skipped 0");

  await page.goto("/duplicates");
  await expect(page.getByRole("heading", { name: "These look like the same person" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Keep Ada Hope (ada.hope@example.test)" }).click();
  await expect(page.getByText("Merged. You can undo it for 7 days.")).toBeVisible();
  await page.getByRole("button", { name: "Undo merge" }).click();
  await expect(page.getByText("Undone. Both people are back.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Not the same" }).first()).toBeVisible();

  await page.goto("/import");
  await page.getByRole("link", { name: "guests.csv" }).click();
  await page.getByRole("button", { name: "Undo this import" }).click();
  await expect(page.getByText("Undone. People this import added are gone")).toBeVisible();
});
