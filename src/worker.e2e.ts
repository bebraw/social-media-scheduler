import { expect, test } from "@playwright/test";

test("requires login before showing the application home", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await page.getByLabel("Name").fill("Scheduler Admin");
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Social Media Scheduler" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Channel drafts" })).toBeVisible();
  const linkedInTab = page.getByRole("tab", { name: /LinkedIn/ });
  const xTab = page.getByRole("tab", { name: /X/ });
  const blueskyTab = page.getByRole("tab", { name: /Bluesky/ });
  await expect(linkedInTab).toHaveAttribute("aria-selected", "true");
  await expect(xTab).toHaveAttribute("aria-selected", "false");
  await expect(blueskyTab).toHaveAttribute("aria-selected", "false");
  await expect(page.getByLabel("LinkedIn post copy")).toBeVisible();
  await expect(page.getByLabel("X post copy")).not.toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Queued posts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View sent history" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open demo mode" })).toBeVisible();
  await expect(page.getByRole("link", { name: "/api/health" })).toBeVisible();

  await xTab.click();
  await expect(xTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("X post copy")).toBeVisible();
  await expect(page.getByLabel("LinkedIn post copy")).not.toBeVisible();

  await page.getByLabel("X post copy").fill("Queue this X draft for the afternoon slot.");
  await page.getByLabel("X queue slot").selectOption("Tomorrow, 13:00");
  await page.getByRole("button", { name: "Queue post" }).click();

  await expect(page.locator("[data-metric-queued]")).toHaveText("1");
  await expect(page.locator("[data-queued-posts] article").first()).toContainText("Queue this X draft for the afternoon slot.");

  await page.getByRole("link", { name: "View sent history" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sent History" })).toBeVisible();
  await expect(page.getByText("No sent posts are available yet.")).toBeVisible();

  await page.getByRole("link", { name: "Demo mode" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole("heading", { level: 1, name: "Demo Mode" })).toBeVisible();
  await page.getByRole("tab", { name: /X/ }).click();
  await page.getByLabel("X post copy").fill("Queue this demo-only post for tomorrow.");
  await page.getByLabel("X queue slot").selectOption("Tomorrow, 09:00");
  await page.getByRole("button", { name: "Schedule demo post" }).click();

  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator("[data-metric-queued]")).toHaveText("4");
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
    routes: ["/", "/history", "/login", "/api/health", "/demo"],
  });
});

test("serves the generated stylesheet", async ({ request }) => {
  const response = await request.get("/styles.css");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/css");
  await expect(response.text()).resolves.toContain("--color-app-canvas:#f6f7f8");
});
