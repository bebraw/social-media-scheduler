import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password auth", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("rejects unsupported iteration counts", async () => {
    await expect(hashPassword("password", { iterations: 100_001 })).rejects.toThrow("exceeds the Cloudflare-supported maximum");
  });

  it("rejects invalid or unsupported stored hashes", async () => {
    await expect(verifyPassword("password", "invalid")).resolves.toBe(false);

    const salt = btoa(String.fromCharCode(...new Uint8Array(16).fill(1)));
    const derivedKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(2)));

    await expect(verifyPassword("password", `pbkdf2_sha256$100001$${salt}$${derivedKey}`)).rejects.toThrow(
      "Stored password hash uses 100001 PBKDF2 iterations",
    );
  });
});
