import { describe, expect, it } from "vitest";
import { parseDbNumber } from "./db-core";

describe("parseDbNumber", () => {
  it("normalizes numbers and numeric strings", () => {
    expect(parseDbNumber(42)).toBe(42);
    expect(parseDbNumber("18")).toBe(18);
  });

  it("falls back to zero for invalid values", () => {
    expect(parseDbNumber(Number.NaN)).toBe(0);
    expect(parseDbNumber("not-a-number")).toBe(0);
    expect(parseDbNumber(null)).toBe(0);
    expect(parseDbNumber(undefined)).toBe(0);
  });
});
