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
  await expect(page.getByRole("link", { name: "/api/health" })).toBeVisible();

  await xTab.click();
  await expect(xTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("X post copy")).toBeVisible();
  await expect(page.getByLabel("LinkedIn post copy")).not.toBeVisible();

  await page.getByLabel("X post copy").fill("Queue this X draft for the afternoon slot.");
  await page.getByLabel("X queue slot").selectOption("Today, 16:30");
  await page.getByRole("button", { name: "Queue post" }).click();

  await expect(page.locator("[data-metric-queued]")).toHaveText("5");
  await expect(page.locator("[data-queued-posts] article").first()).toContainText("Queue this X draft for the afternoon slot.");
});

test("serves the health endpoint", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({
    ok: true,
    name: "social-media-scheduler",
    routes: ["/", "/login", "/api/health"],
  });
});

test("serves the generated stylesheet", async ({ request }) => {
  const response = await request.get("/styles.css");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/css");
  await expect(response.text()).resolves.toContain("--color-app-canvas:#f6f7f8");
});
