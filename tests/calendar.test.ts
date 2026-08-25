import assert from "node:assert/strict";
import test from "node:test";
import { dayRange, monthGrid, monthLabel, shift, viewLabel, weekGrid } from "../lib/calendar";

test("a month grid is always six whole weeks", () => {
  for (const [year, month] of [
    [2026, 1],
    [2026, 7],
    [2024, 1],
  ]) {
    const days = monthGrid(year, month);
    assert.equal(days.length, 42);
    assert.equal(days.length % 7, 0);
  }
});

test("the grid starts on a Sunday and borrows the adjacent months", () => {
  // March 2026 starts on a Sunday, so there is nothing to borrow at the front.
  const march = monthGrid(2026, 2);
  assert.equal(march[0].iso, "2026-03-01");
  assert.equal(march[0].inMonth, true);
  assert.equal(march[31].iso, "2026-04-01");
  assert.equal(march[31].inMonth, false, "April days are marked as outside the month");

  // August 2026 starts on a Saturday, so the row opens in July.
  const august = monthGrid(2026, 7);
  assert.equal(august[0].iso, "2026-07-26");
  assert.equal(august[0].inMonth, false);
  assert.equal(august[6].iso, "2026-08-01");
  assert.equal(august[6].inMonth, true);
});

test("weekends are identified for every row", () => {
  const days = monthGrid(2026, 2);
  assert.deepEqual(
    days.slice(0, 7).map((d) => d.isWeekend),
    [true, false, false, false, false, false, true],
  );
});

test("February gets its leap day only in a leap year", () => {
  assert.ok(monthGrid(2024, 1).some((d) => d.iso === "2024-02-29" && d.inMonth));
  assert.ok(!monthGrid(2026, 1).some((d) => d.iso === "2026-02-29" && d.inMonth));
});

test("month arithmetic preserves the day-of-month, clamped when the target month is shorter", () => {
  assert.equal(shift("month", "2026-01-15", -1), "2025-12-15");
  assert.equal(shift("month", "2026-12-15", 1), "2027-01-15");
  // January 31st + 1 month must clamp into February, not spill into March.
  assert.equal(shift("month", "2026-01-31", 1), "2026-02-28", "2026 is not a leap year");
  assert.equal(shift("month", "2024-01-31", 1), "2024-02-29", "2024 is a leap year");
  // December 31st - 1 month must clamp into November, not spill into October.
  assert.equal(shift("month", "2026-12-31", -1), "2026-11-30");
});

test("day and week arithmetic step by the active view", () => {
  assert.equal(shift("day", "2026-03-01", 1), "2026-03-02");
  assert.equal(shift("day", "2026-03-01", -1), "2026-02-28");
  assert.equal(shift("week", "2026-03-01", 1), "2026-03-08");
  assert.equal(shift("week", "2026-03-01", -1), "2026-02-22");
});

test("the month label names both month and year", () => {
  assert.match(monthLabel(2026, 2), /2026/);
});

test("weekGrid returns the Sunday-first week containing the anchor", () => {
  // 2026-03-11 is a Wednesday; the week runs Sun 2026-03-08 to Sat 2026-03-14.
  const week = weekGrid("2026-03-11");
  assert.equal(week.length, 7);
  assert.equal(week[0].iso, "2026-03-08");
  assert.equal(week[6].iso, "2026-03-14");
  assert.deepEqual(
    week.map((d) => d.isWeekend),
    [true, false, false, false, false, false, true],
  );
  assert.ok(week.every((d) => d.inMonth), "week rows are never dimmed as out-of-month");
});

test("weekGrid crosses a month boundary without losing a day", () => {
  // August 2026 opens on a Saturday (per the monthGrid tests above), so the
  // week anchored inside it starts in July.
  const week = weekGrid("2026-07-29");
  assert.equal(week[0].iso, "2026-07-26");
  assert.equal(week[6].iso, "2026-08-01");

  const week2 = weekGrid("2026-03-02");
  assert.equal(week2[0].iso, "2026-03-01");
  assert.equal(week2[6].iso, "2026-03-07");
});

test("dayRange returns exactly the one requested day", () => {
  const [day] = dayRange("2026-03-11");
  assert.equal(day.iso, "2026-03-11");
  assert.equal(day.dayOfMonth, 11);
  assert.equal(day.isWeekend, false);
  assert.equal(day.inMonth, true);

  const [sunday] = dayRange("2026-03-08");
  assert.equal(sunday.isWeekend, true);
});

test("viewLabel names the day, the week's range, and the month, per view", () => {
  assert.match(viewLabel("day", "2026-03-11"), /March 11, 2026/);

  const sameMonth = viewLabel("week", "2026-03-11");
  assert.match(sameMonth, /Mar 8/);
  assert.match(sameMonth, /Mar 14, 2026/);

  // 2026-07-26 is a Sunday and 2026-08-01 the following Saturday, so this
  // week's anchor lands on a range that spans July into August.
  const crossMonth = viewLabel("week", "2026-07-29");
  assert.match(crossMonth, /Jul 26/);
  assert.match(crossMonth, /Aug 1, 2026/);

  assert.match(viewLabel("month", "2026-03-11"), /March 2026/);
});
