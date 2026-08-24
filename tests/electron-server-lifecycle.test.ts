import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createServerLifecycle } from "../electron/server-lifecycle.js";

const main = readFileSync(resolve(import.meta.dirname, "../electron/main.js"), "utf8");

test("reopening a window reuses the process-local server", () => {
  assert.match(main, /createServerLifecycle/);
  assert.match(main, /await serverLifecycle\.getUrl\(\)/);
  assert.match(main, /serverLifecycle\.reset\(\)/);
});

test("a concurrent reopen shares one in-flight server startup", async () => {
  let starts = 0;
  const lifecycle = createServerLifecycle(async () => {
    starts += 1;
    await Promise.resolve();
    return "http://127.0.0.1:39847";
  });

  const [first, second] = await Promise.all([lifecycle.getUrl(), lifecycle.getUrl()]);
  assert.equal(first, "http://127.0.0.1:39847");
  assert.equal(second, first);
  assert.equal(starts, 1);

  lifecycle.reset();
  await lifecycle.getUrl();
  assert.equal(starts, 2);
});
