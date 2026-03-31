import { describe, expect, it } from "vitest";
import { isAccessRole } from "./types";

describe("isAccessRole", () => {
  it("accepts supported roles and rejects other values", () => {
    expect(isAccessRole("editor")).toBe(true);
    expect(isAccessRole("readonly")).toBe(true);
    expect(isAccessRole("admin")).toBe(false);
    expect(isAccessRole(null)).toBe(false);
  });
});
