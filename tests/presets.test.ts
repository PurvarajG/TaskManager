import assert from "node:assert/strict";
import test from "node:test";
import { presetChips } from "../components/tracking/presets";
import type { Activity, Category } from "../lib/types";

const now = "2026-01-01T00:00:00.000Z";

const categories: Category[] = [
  { id: "cat-1", name: "Focus Work", color: "cat-indigo", kind: "work", sortOrder: 0, archived: false, createdAt: now },
];

function activity(overrides: Partial<Activity> & Pick<Activity, "id" | "name">): Activity {
  return {
    categoryId: "cat-1",
    isPreset: true,
    pinned: false,
    sortOrder: 0,
    archived: false,
    createdAt: now,
    ...overrides,
  };
}

test("presetChips splits pinned presets from the rest", () => {
  const activities = [
    activity({ id: "a1", name: "Deep work", pinned: true }),
    activity({ id: "a2", name: "Meetings", pinned: false }),
    activity({ id: "a3", name: "Email", pinned: false }),
  ];

  const { pinned, rest } = presetChips(activities, categories);
  assert.deepEqual(pinned.map((c) => c.activity.id), ["a1"]);
  assert.deepEqual(rest.map((c) => c.activity.id), ["a2", "a3"]);
});

test("presetChips excludes non-preset and archived activities", () => {
  const activities = [
    activity({ id: "a1", name: "Deep work", pinned: true }),
    activity({ id: "a2", name: "Not a preset", isPreset: false, pinned: true }),
    activity({ id: "a3", name: "Archived", pinned: true, archived: true }),
  ];

  const { pinned, rest } = presetChips(activities, categories);
  assert.deepEqual(pinned.map((c) => c.activity.id), ["a1"]);
  assert.equal(rest.length, 0);
});

test("presetChips drops activities whose category is missing (orphans)", () => {
  const activities = [
    activity({ id: "a1", name: "Deep work", categoryId: "missing-category", pinned: true }),
  ];

  const { pinned, rest } = presetChips(activities, categories);
  assert.equal(pinned.length, 0);
  assert.equal(rest.length, 0);
});

test("presetChips falls back to the first five presets when nothing is pinned", () => {
  const activities = Array.from({ length: 7 }, (_, i) =>
    activity({ id: `a${i}`, name: `Activity ${i}`, pinned: false }),
  );

  const { pinned, rest } = presetChips(activities, categories);
  assert.deepEqual(pinned.map((c) => c.activity.id), ["a0", "a1", "a2", "a3", "a4"]);
  assert.deepEqual(rest.map((c) => c.activity.id), ["a5", "a6"]);
});
