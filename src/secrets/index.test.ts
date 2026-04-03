import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../test-support";
import {
  decryptSecretValue,
  encryptSecretValue,
  loadEncryptedSecret,
  loadStoredSecrets,
  resolveAppEncryptionSecret,
  saveEncryptedSecret,
} from "./index";

describe("secret storage", () => {
  it("round-trips encrypted values without storing plaintext", async () => {
    const db = createTestDatabase();

    await saveEncryptedSecret(db, "channel_connection:test:access_token", "x-token-123", "app-secret");

    const storedSecrets = await loadStoredSecrets(db);
    expect(storedSecrets).toHaveLength(1);
    expect(storedSecrets[0]?.encryptedValue).not.toContain("x-token-123");
    await expect(loadEncryptedSecret(db, "channel_connection:test:access_token", "app-secret")).resolves.toBe("x-token-123");
  });

  it("encrypts and decrypts a payload directly", async () => {
    const encryptedValue = await encryptSecretValue("refresh-token-abc", "app-secret");

    expect(encryptedValue).not.toContain("refresh-token-abc");
    await expect(decryptSecretValue(encryptedValue, "app-secret")).resolves.toBe("refresh-token-abc");
  });

  it("resolves APP_ENCRYPTION_SECRET before falling back to SESSION_SECRET", () => {
    expect(
      resolveAppEncryptionSecret({
        APP_ENCRYPTION_SECRET: " dedicated-secret ",
        SESSION_SECRET: "session-secret",
      }),
    ).toBe("dedicated-secret");
    expect(
      resolveAppEncryptionSecret({
        SESSION_SECRET: "session-secret",
      }),
    ).toBe("session-secret");
  });
});
