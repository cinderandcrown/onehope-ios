import { expect, test } from "@playwright/test";

test("a guest can open Home, Watch, Know Jesus, Give, and Plan a Visit without an account", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/member");
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sundays at 10:30 a.m." })).toBeVisible();
  await expect(page.getByText(/Daily Word · /)).toBeVisible();
  await page.getByRole("button", { name: "I read today's Word" }).click();
  await expect(page.getByText("1 day in a row")).toBeVisible();

  await page.getByRole("tab", { name: "Watch" }).click();
  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
  // YouTube refuses embeds without a Referer (Error 153); the feed is live, so only check when a video loaded.
  const player = page.locator("iframe.player");
  if ((await player.count()) > 0) {
    await expect(player).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    await expect(page.getByRole("link", { name: "Play on YouTube" })).toHaveAttribute(
      "href",
      /^https:\/\/www\.youtube\.com\/watch\?v=/,
    );
  }

  await page.getByRole("tab", { name: "Give" }).click();
  await expect(page.getByRole("link", { name: "Give online" })).toHaveAttribute(
    "href",
    "https://weareonehope.churchcenter.com/giving",
  );
  await expect(page.getByRole("link", { name: "Text 84321" })).toBeVisible();
  await expect(page.getByText("PO Box 211926, Dallas, TX 75211")).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveCount(0);

  await page.getByRole("tab", { name: "Know Jesus" }).click();
  await expect(page.getByText("John 3:16 (KJV)")).toBeVisible();
  await page.getByRole("button", { name: "I decided to follow Jesus" }).click();
  await page.getByLabel("Your name").fill("E2E Guest Decision");
  await page.getByLabel("Email (optional)").fill("guest@onehope.test");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Check the box so we can contact you/)).toBeVisible();
  await page.getByLabel(/One Hope may contact me/).check();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/best decision you'll ever make/)).toBeVisible();
  await expect(page.getByText("Day 7 · You belong")).toBeVisible();

  await page.getByRole("tab", { name: "Home" }).click();
  await page.getByRole("button", { name: "Plan a Visit" }).first().click();
  await expect(page.getByRole("heading", { name: "Plan a Visit" })).toBeVisible();
  const calendar = await page.getByRole("link", { name: "Add to calendar" }).getAttribute("href");
  const ics = await page.request.get(calendar ?? "");
  expect(await ics.text()).toContain("BEGIN:VCALENDAR");
  await page.getByRole("button", { name: "I'm coming" }).click();
  await page.getByLabel("Your name").fill("E2E Visitor");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/We can't wait to meet you/)).toBeVisible();

  await page.getByRole("tab", { name: "Connect" }).click();
  await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Toolkit for Spiritual Growth" })).toBeVisible();
  await expect(page.getByText("2 Timothy 1:7 (KJV)")).toBeVisible();
  await page.getByRole("button", { name: "Recovery" }).click();
  await page.getByRole("slider", { name: "Faith/Spirituality" }).fill("7");
  await expect(page.getByText("Faith/Spirituality: 7")).toBeVisible();
  await page.getByRole("button", { name: "Care" }).click();
  await page.getByRole("button", { name: "Send support request" }).click();
  await expect(page.getByText("Please check at least one box.")).toBeVisible();
  await page.getByLabel("In need of clothing").check();
  await page.getByLabel("Your name").fill("E2E Support Guest");
  await page.getByLabel("Phone").fill("214-555-0100");
  await page.getByLabel(/One Hope may contact me/).check();
  await page.getByRole("button", { name: "Send support request" }).click();
  await expect(page.getByText(/Someone from One Hope will contact you soon/)).toBeVisible();
});

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
  await page.getByRole("tab", { name: "Connect" }).click();
  const create = page.locator("form").filter({ has: page.getByRole("button", { name: "Create account" }) });
  await create.getByLabel("Name").fill("Member Test");
  await create.getByLabel("Email").fill(email);
  await create.getByLabel("Password").fill("gathering");
  await create.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  await page.getByRole("tab", { name: "Connect" }).click();
  await expect(page.getByRole("heading", { name: "Know Jesus" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Growth Track" }).first()).toBeVisible();
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
  const ics = await page.request.get(href ?? "");
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("BEGIN:VCALENDAR");
  await page.getByRole("button", { name: "Send prayer request" }).click();
  await expect(page.getByText("Tell us how we can serve you and describe your prayer need.")).toBeVisible();
  await page.getByLabel("How can we serve you?").fill("Pray for my city");
  await page.getByLabel("Please contact me").check();
  await page.getByLabel("Please describe your prayer need").fill("Pray for Richardson.");
  await page.getByRole("button", { name: "Send prayer request" }).click();
  await expect(page.getByText("Waiting for pastor approval")).toBeVisible();
  await expect(page.getByText("A pastor will contact you.")).toBeVisible();
  await page.getByPlaceholder("Child's name").fill("QA Child");
  await page.getByRole("button", { name: "Add child" }).click();
  await expect(page.getByText("QA Child was added.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check in" })).toBeVisible();
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText(/Security code \d{4}/)).toBeVisible();
  await expect(page.getByText("Checked in", { exact: true })).toBeVisible();
  const tag = (await page.getByLabel("Security code", { exact: true }).locator("strong").textContent()) ?? "";
  await page.getByLabel("Security code for pickup").fill(tag);
  await page.getByRole("button", { name: "Pick up QA Child" }).click();
  await expect(page.getByText(/Two adults must be on duty|QA Child is picked up/)).toBeVisible();

  await page.getByRole("tab", { name: "Know Jesus" }).click();
  await page.getByRole("button", { name: "I want to be baptized" }).click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Wonderful. A pastor will reach out about baptism.")).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Connect" }).click();
  await expect(page.getByText("Requested. A pastor will reach out.")).toBeVisible();

  await page.getByLabel("List me in the directory").check();
  await page.getByRole("button", { name: "Save privacy" }).click();
  await expect(page.getByText("Your privacy settings were saved.")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Password to delete").fill("wrong-password");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Connect" })).toBeVisible();
  await expect(page.getByText("That password didn't match.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Connect" }).click();
  const signIn = page.locator("form").filter({ has: page.getByRole("button", { name: "Sign in" }) });
  await signIn.getByLabel("Email").fill(email);
  await signIn.getByLabel("Password").fill("wrong-password");
  await signIn.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
});
