import assert from "node:assert/strict";
import test from "node:test";
import { monthGrid, monthLabel, shiftMonth } from "../lib/calendar";

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

test("month arithmetic can't land on a day that doesn't exist", () => {
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  // January 31st + 1 month must be February, not March 3rd.
  assert.deepEqual(shiftMonth(2026, 0, 1), { year: 2026, month: 1 });
});

test("the month label names both month and year", () => {
  assert.match(monthLabel(2026, 2), /2026/);
});
