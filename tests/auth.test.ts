import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  passwordMatches,
  safeReturnPath,
  verifySessionToken,
} from "../lib/auth";

const secret = "a-secure-test-secret-that-is-long-enough";

test("creates and verifies a valid session", async () => {
  const token = await createSessionToken(secret, 1_000);
  assert.equal(await verifySessionToken(token, secret, 1_001), true);
});

test("rejects tampered and expired sessions", async () => {
  const token = await createSessionToken(secret, 1_000);
  assert.equal(await verifySessionToken(`${token}x`, secret, 1_001), false);
  assert.equal(await verifySessionToken(token, secret, 1_000 + 30 * 24 * 60 * 60 + 1), false);
});

test("compares passwords without exposing partial matches", async () => {
  assert.equal(await passwordMatches("owner-password", "owner-password"), true);
  assert.equal(await passwordMatches("owner-passworD", "owner-password"), false);
  assert.equal(await passwordMatches("short", "owner-password"), false);
});

test("only accepts safe same-origin return paths", () => {
  assert.equal(safeReturnPath("/all?view=open"), "/all?view=open");
  for (const value of [undefined, "", "https://evil.test", "//evil.test", "/login", "/login?next=/all", "all"]) {
    assert.equal(safeReturnPath(value), "/");
  }
});
