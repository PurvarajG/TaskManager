import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "../lib/auth";
import { proxy } from "../proxy";

const secret = "proxy-test-secret-that-is-long-enough";

test.beforeEach(() => { process.env.SESSION_SECRET = secret; });
test.afterEach(() => { delete process.env.SESSION_SECRET; });

test("rejects anonymous API requests with JSON 401", async () => {
  const response = await proxy(new NextRequest("https://app.test/api/tasks"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Authentication required" });
});

test("redirects anonymous pages to login with a safe return path", async () => {
  const response = await proxy(new NextRequest("https://app.test/all?view=open"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://app.test/login?next=%2Fall%3Fview%3Dopen");
});

test("leaves the login surface public", async () => {
  assert.equal((await proxy(new NextRequest("https://app.test/login"))).status, 200);
  assert.equal((await proxy(new NextRequest("https://app.test/api/auth/login"))).status, 200);
});

test("lets the calendar feed through, since Apple Calendar can't carry a cookie", async () => {
  // The route guards itself with CALENDAR_FEED_SECRET instead — see app/api/calendar-feed/route.ts.
  const response = await proxy(new NextRequest("https://app.test/api/calendar-feed?token=whatever"));
  assert.equal(response.status, 200);
});

test("the feed exemption does not extend to any other API path", async () => {
  assert.equal((await proxy(new NextRequest("https://app.test/api/calendar-feed/all"))).status, 401);
  assert.equal((await proxy(new NextRequest("https://app.test/api/tasks?token=whatever"))).status, 401);
});

test("allows a valid session and rejects a tampered session", async () => {
  const token = await createSessionToken(secret);
  const valid = new NextRequest("https://app.test/api/tasks", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
  const invalid = new NextRequest("https://app.test/api/tasks", { headers: { cookie: `${SESSION_COOKIE}=${token}x` } });
  assert.equal((await proxy(valid)).status, 200);
  assert.equal((await proxy(invalid)).status, 401);
});

test("lets requests through when no secret is configured (local scratch instance)", async () => {
  delete process.env.SESSION_SECRET;
  assert.equal((await proxy(new NextRequest("https://app.test/api/tasks"))).status, 200);
});
