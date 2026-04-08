import { expect, test } from "@playwright/test";

const SEEDED_CONNECTION_HANDLE = "@scheduler-admin-e2e";
const SEEDED_CONNECTION_LABEL = "Personal X E2E";

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
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Queued posts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo mode" })).toHaveCount(0);

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.locator("[data-channel-connection]").filter({ hasText: SEEDED_CONNECTION_LABEL })).toHaveCount(1);
  await expect(page.getByText(SEEDED_CONNECTION_HANDLE)).toBeVisible();

  await page.getByRole("link", { name: "Queue", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByLabel("X Mon").uncheck();
  await page.getByLabel("X Tue").uncheck();
  await page.getByLabel("X Wed").check();
  await page.getByLabel("X Thu").check();
  await page.getByLabel("X Fri").uncheck();
  await page.getByLabel("X UTC time").fill("10:45");
  await page.getByRole("button", { name: "Save posting schedule" }).click();
  await expect(page).toHaveURL(/\/\?schedule=updated$/);
  await expect(page.getByText("Posting schedule saved.")).toBeVisible();
  await expect(page.locator('[data-posting-cron="x"]')).toHaveText("45 10 * * WED,THU");

  await page.getByRole("link", { name: "Compose", exact: true }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByRole("heading", { level: 1, name: "Compose" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Channel drafts" })).toBeVisible();
  const personalXTab = page.getByRole("tab", { name: new RegExp(SEEDED_CONNECTION_LABEL) });
  await personalXTab.click();
  await expect(personalXTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel(`${SEEDED_CONNECTION_LABEL} post copy`)).toBeVisible();
  await page.getByLabel(`${SEEDED_CONNECTION_LABEL} post copy`).fill("Queue this X draft for the afternoon slot.");
  await page.getByLabel(`${SEEDED_CONNECTION_LABEL} queue slot`).selectOption("Tomorrow, 13:00");
  await page.getByRole("button", { name: "Queue post" }).click();

  await expect(page.locator("[data-metric-queued]")).toHaveText("1");
  await expect(page.locator("[data-queued-posts] article").first()).toContainText("Queue this X draft for the afternoon slot.");

  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(SEEDED_CONNECTION_LABEL) })).toBeVisible();
  await expect(page.getByText("No sent posts are available yet.")).toBeVisible();
});

test("serves the health endpoint", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({
    ok: true,
    name: "social-media-scheduler",
    routes: ["/", "/compose", "/history", "/settings", "/settings/channels", "/posting-schedule", "/login", "/api/health"],
  });
});

test("serves the generated stylesheet", async ({ request }) => {
  const response = await request.get("/styles.css");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/css");
  await expect(response.text()).resolves.toContain("--color-app-canvas:#f6f7f8");
});
