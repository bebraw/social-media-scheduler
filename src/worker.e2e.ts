import { expect, test } from "@playwright/test";

test("requires login before showing the application home", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await page.getByLabel("Name").fill("Scheduler Admin");
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Social Media Scheduler" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Compose post" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Queued posts" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to queue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "/api/health" })).toBeVisible();
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
