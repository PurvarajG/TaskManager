import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { DELETE as deleteActivity, PATCH as patchActivity } from "../app/api/activities/[id]/route";
import { GET as listActivities, POST as addActivity } from "../app/api/activities/route";
import { DELETE as deleteCategory, PATCH as patchCategory } from "../app/api/categories/[id]/route";
import { GET as listCategories, POST as addCategory } from "../app/api/categories/route";
import { GET as getSettings, PATCH as patchSettings } from "../app/api/tracking-settings/route";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;

before(async () => {
  db = await freshDb();
});
after(async () => db.close());

function req(url: string, init?: RequestInit): Request {
  return new Request(`https://app.test${url}`, init);
}

function body(value: unknown, method = "POST"): RequestInit {
  return { method, body: JSON.stringify(value), headers: { "content-type": "application/json" } };
}

function idCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

test("categories list seeds the seven defaults, and a new one can be added", async () => {
  const listed = await listCategories();
  assert.equal((await listed.json()).length, 7);

  const created = await addCategory(req("/api/categories", body({ name: "Deep Work", color: "cat-cyan", kind: "work" })));
  assert.equal(created.status, 201);
  assert.equal((await created.json()).name, "Deep Work");
});

test("a category can be renamed and recoloured", async () => {
  const created = await addCategory(req("/api/categories", body({ name: "Chores", color: "cat-slate", kind: "upkeep" })));
  const { id } = await created.json();

  const patched = await patchCategory(req(`/api/categories/${id}`, body({ name: "Errands" }, "PATCH")), idCtx(id));
  assert.equal(patched.status, 200);
  assert.equal((await patched.json()).name, "Errands");
});

test("deleting a category with recorded time is refused with 409; archiving still works", async () => {
  const created = await addCategory(req("/api/categories", body({ name: "In Use", color: "cat-rose", kind: "rest" })));
  const category = await created.json();

  await db.store.addManualSegment({
    startedAt: "2026-04-05T09:00:00.000Z",
    endedAt: "2026-04-05T09:30:00.000Z",
    categoryId: category.id,
  });

  const deleted = await deleteCategory(req(`/api/categories/${category.id}`, { method: "DELETE" }), idCtx(category.id));
  assert.equal(deleted.status, 409);

  const archived = await patchCategory(
    req(`/api/categories/${category.id}`, body({ archived: true }, "PATCH")),
    idCtx(category.id),
  );
  assert.equal(archived.status, 200);
  assert.equal((await archived.json()).archived, true);
});

test("activities can be listed by category, added, edited, and deleted", async () => {
  const categories = await (await listCategories()).json();
  const categoryId = categories[0].id;

  const created = await addActivity(
    req("/api/activities", body({ categoryId, name: "Standup", typicalMinutes: 15 })),
  );
  assert.equal(created.status, 201);
  const activity = await created.json();

  const listed = await listActivities(req(`/api/activities?categoryId=${categoryId}`));
  const names = (await listed.json()).map((a: { name: string }) => a.name);
  assert.ok(names.includes("Standup"));

  const patched = await patchActivity(
    req(`/api/activities/${activity.id}`, body({ name: "Daily Standup" }, "PATCH")),
    idCtx(activity.id),
  );
  assert.equal((await patched.json()).name, "Daily Standup");

  const deleted = await deleteActivity(req(`/api/activities/${activity.id}`, { method: "DELETE" }), idCtx(activity.id));
  assert.equal(deleted.status, 200);
});

test("tracking settings can be read and patched", async () => {
  const initial = await (await getSettings()).json();
  assert.equal(initial.dayStartHour, 4);
  assert.equal(initial.wakingStartHour, 7);

  const patched = await patchSettings(req("/api/tracking-settings", body({ minGapMinutes: 15 }, "PATCH")));
  assert.equal(patched.status, 200);
  const settings = await patched.json();
  assert.equal(settings.minGapMinutes, 15);
  assert.equal(settings.dayStartHour, 4, "unpatched fields are untouched");
});

test("an out-of-range hour is a 400", async () => {
  const res = await patchSettings(req("/api/tracking-settings", body({ dayStartHour: 24 }, "PATCH")));
  assert.equal(res.status, 400);
});
