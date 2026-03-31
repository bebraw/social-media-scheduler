import { describe, expect, it } from "vitest";
import { renderLoginPage } from "./login";

describe("renderLoginPage", () => {
  it("renders the sign-in form and error copy", () => {
    const html = renderLoginPage({
      error: "Invalid credentials.",
      userCount: 1,
    });

    expect(html).toContain("Sign in");
    expect(html).toContain("Invalid credentials.");
    expect(html).toContain('method="post" action="/login"');
  });
});
