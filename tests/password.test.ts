import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../lib/password";

test("hashes a password with a random salt each time", () => {
  const a = hashPassword("correct-horse-battery-staple");
  const b = hashPassword("correct-horse-battery-staple");
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
});

test("verifies a matching password and rejects a wrong one", () => {
  const { hash, salt } = hashPassword("correct-horse-battery-staple");
  assert.equal(verifyPassword("correct-horse-battery-staple", hash, salt), true);
  assert.equal(verifyPassword("wrong-password", hash, salt), false);
});

test("rejects a password verified against a different salt", () => {
  const a = hashPassword("correct-horse-battery-staple");
  const b = hashPassword("correct-horse-battery-staple");
  assert.equal(verifyPassword("correct-horse-battery-staple", a.hash, b.salt), false);
});
