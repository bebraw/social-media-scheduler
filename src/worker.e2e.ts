import { expect, test } from "@playwright/test";

test("requires login before showing the default queue view", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await page.getByLabel("Name").fill("Scheduler Admin");
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Queue" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Queue status" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Posting schedule" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Compose", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Queued posts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open demo mode" })).toBeVisible();

  await page.getByLabel("LinkedIn Mon").uncheck();
  await page.getByLabel("LinkedIn Wed").uncheck();
  await page.getByLabel("LinkedIn Fri").uncheck();
  await page.getByLabel("LinkedIn Tue").check();
  await page.getByLabel("LinkedIn Thu").check();
  await page.getByLabel("LinkedIn UTC time").fill("10:45");
  await page.getByRole("button", { name: "Save posting schedule" }).click();
  await expect(page).toHaveURL(/\/\?schedule=updated$/);
  await expect(page.getByText("Posting schedule saved.")).toBeVisible();
  await expect(page.locator('[data-posting-cron="linkedin"]')).toHaveText("45 10 * * TUE,THU");

  await page.getByRole("link", { name: "Compose", exact: true }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByRole("heading", { level: 1, name: "Compose" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Channel drafts" })).toBeVisible();
  const linkedInTab = page.getByRole("tab", { name: /LinkedIn/ });
  const xTab = page.getByRole("tab", { name: /X/ });
  const blueskyTab = page.getByRole("tab", { name: /Bluesky/ });
  await expect(linkedInTab).toHaveAttribute("aria-selected", "true");
  await expect(xTab).toHaveAttribute("aria-selected", "false");
  await expect(blueskyTab).toHaveAttribute("aria-selected", "false");
  await expect(page.getByLabel("LinkedIn post copy")).toBeVisible();
  await expect(page.getByLabel("X post copy")).not.toBeVisible();

  await xTab.click();
  await expect(xTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("X post copy")).toBeVisible();
  await expect(page.getByLabel("LinkedIn post copy")).not.toBeVisible();

  await page.getByLabel("X post copy").fill("Queue this X draft for the afternoon slot.");
  await page.getByLabel("X queue slot").selectOption("Tomorrow, 13:00");
  await page.getByRole("button", { name: "Queue post" }).click();

  await expect(page.locator("[data-metric-queued]")).toHaveText("1");
  await expect(page.locator("[data-queued-posts] article").first()).toContainText("Queue this X draft for the afternoon slot.");

  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();
  await expect(page.getByText("No sent posts are available yet.")).toBeVisible();

  await page.getByRole("link", { name: "Demo mode" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole("heading", { level: 1, name: "Demo Mode" })).toBeVisible();
  const queuedBeforeDemoPost = Number((await page.locator("[data-metric-queued]").textContent()) || "0");
  await page.getByRole("tab", { name: /X/ }).click();
  await page.getByLabel("X post copy").fill("Queue this demo-only post for tomorrow.");
  await page.getByLabel("X queue slot").selectOption("Tomorrow, 09:00");
  await page.getByRole("button", { name: "Schedule demo post" }).click();

  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator("[data-metric-queued]")).toHaveText(String(queuedBeforeDemoPost + 1));
  await expect(page.locator("[data-queued-posts] article").first()).toContainText("Queue this demo-only post for tomorrow.");
  await page.getByRole("button", { name: /X 2/ }).click();
  await expect(page.locator('[data-history-filter="x"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-sent-history-list] article:visible")).toHaveCount(2);
  await expect(page.locator("[data-history-count]")).toHaveText("2");
});

test("serves the health endpoint", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({
    ok: true,
    name: "social-media-scheduler",
    routes: ["/", "/compose", "/history", "/posting-schedule", "/login", "/api/health", "/demo"],
  });
});

test("serves the generated stylesheet", async ({ request }) => {
  const response = await request.get("/styles.css");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/css");
  await expect(response.text()).resolves.toContain("--color-app-canvas:#f6f7f8");
});
