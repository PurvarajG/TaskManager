import assert from "node:assert/strict";
import test from "node:test";
import * as v from "../lib/validate";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

test("rejects dates that only look like dates", () => {
  assert.equal(v.isoDate("2026-03-01", "scheduled"), "2026-03-01");
  assert.throws(() => v.isoDate("2026-02-30", "scheduled"), v.Invalid);
  assert.throws(() => v.isoDate("2026-13-01", "scheduled"), v.Invalid);
  assert.throws(() => v.isoDate("March 1", "scheduled"), v.Invalid);
});

test("times must be a real 24-hour clock reading", () => {
  assert.equal(v.optionalTime("09:30", "dueTime"), "09:30");
  assert.equal(v.optionalTime("", "dueTime"), undefined);
  assert.throws(() => v.optionalTime("24:00", "dueTime"), v.Invalid);
  assert.throws(() => v.optionalTime("9:30", "dueTime"), v.Invalid);
});

test("enums are closed sets", () => {
  assert.equal(v.stageKind("blocked", "kind"), "blocked");
  assert.throws(() => v.stageKind("archived", "kind"), v.Invalid);
  assert.equal(v.priority(2, "priority"), 2);
  assert.throws(() => v.priority(4, "priority"), v.Invalid);
  assert.equal(v.categoryKind("upkeep", "kind"), "upkeep");
  assert.throws(() => v.categoryKind("hobby", "kind"), v.Invalid);
});

test("an hour is a whole 0-23, and a string list rejects non-lists", () => {
  assert.equal(v.hour(4, "dayStartHour"), 4);
  assert.equal(v.hour(23, "dayStartHour"), 23);
  assert.throws(() => v.hour(24, "dayStartHour"), v.Invalid);
  assert.throws(() => v.hour(-1, "dayStartHour"), v.Invalid);
  assert.throws(() => v.hour(4.5, "dayStartHour"), v.Invalid);
  assert.deepEqual(v.stringList(["now", "ribbon"], "moduleOrder"), ["now", "ribbon"]);
  assert.throws(() => v.stringList("now", "moduleOrder"), v.Invalid);
});

test("ids must be well-formed before they reach SQL", () => {
  assert.equal(v.uuid(uuid, "id"), uuid);
  assert.throws(() => v.uuid("'; drop table tasks; --", "id"), v.Invalid);
  assert.equal(v.optionalUuid("", "projectId"), undefined);
  assert.deepEqual(v.uuidList([uuid], "ids"), [uuid]);
  assert.throws(() => v.uuidList(uuid, "ids"), v.Invalid);
});

test("required text can't be whitespace, and durations have bounds", () => {
  assert.equal(v.nonEmpty("  Write the plan  ", "Title"), "Write the plan");
  assert.throws(() => v.nonEmpty("   ", "Title"), v.Invalid);
  assert.throws(() => v.minutes(0, "minutes"), v.Invalid);
  assert.throws(() => v.minutes(1.5, "minutes"), v.Invalid);
  assert.equal(v.minutes(90, "minutes"), 90);
});

test("estimates have no upper bound — a task can be its own miniproject", () => {
  assert.equal(v.duration(45, "minutes"), 45);
  assert.equal(v.duration(60 * 24 * 30, "minutes"), 43_200);
  assert.equal(v.minutes(60 * 40, "minutes"), 2_400, "a tracked session can run past a day");
  assert.throws(() => v.duration(0, "minutes"), v.Invalid);
  assert.throws(() => v.duration(12.5, "minutes"), v.Invalid);
});

test("booleans must be actual booleans, not truthy strings", () => {
  assert.equal(v.bool(true, "isComplex"), true);
  assert.equal(v.bool(false, "isComplex"), false);
  assert.throws(() => v.bool("true", "isComplex"), v.Invalid);
  assert.throws(() => v.bool(1, "isComplex"), v.Invalid);
});

test("bodies must be objects", () => {
  assert.deepEqual(v.body({ a: 1 }), { a: 1 });
  assert.throws(() => v.body([1, 2]), v.Invalid);
  assert.throws(() => v.body(null), v.Invalid);
});
