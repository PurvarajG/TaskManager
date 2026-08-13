import assert from "node:assert/strict";
import test from "node:test";
import { LoginRateLimiter } from "../lib/rate-limit";

test("allows five attempts then throttles until the window resets", () => {
  const limiter = new LoginRateLimiter({ limit: 5, windowMs: 1_000, maxKeys: 10 });
  for (let i = 0; i < 5; i++) assert.deepEqual(limiter.consume("owner", 0), { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(limiter.consume("owner", 0), { allowed: false, retryAfterSeconds: 1 });
  assert.deepEqual(limiter.consume("owner", 1_001), { allowed: true, retryAfterSeconds: 0 });
});

test("reset clears attempts after a successful login", () => {
  const limiter = new LoginRateLimiter({ limit: 1, windowMs: 1_000, maxKeys: 10 });
  limiter.consume("owner", 0);
  limiter.reset("owner");
  assert.equal(limiter.consume("owner", 0).allowed, true);
});

test("keeps the limiter bounded", () => {
  const limiter = new LoginRateLimiter({ limit: 1, windowMs: 1_000, maxKeys: 2 });
  limiter.consume("a", 0);
  limiter.consume("b", 0);
  limiter.consume("c", 0);
  assert.equal(limiter.size, 2);
});
