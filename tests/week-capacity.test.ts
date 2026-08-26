import assert from "node:assert/strict";
import test from "node:test";
import { buildWeekPlan, capacityCeilingMinutes, weekMetrics } from "../lib/week-capacity";
import type { Task, TrackingSettings } from "../lib/types";

const SETTINGS: TrackingSettings = {
  dayStartHour: 4,
  wakingStartHour: 7,
  wakingEndHour: 23,
  minGapMinutes: 10,
  moduleOrder: [],
  hiddenModules: [],
  collapsedModules: [],
  hiddenNavItems: [],
  updatedAt: new Date().toISOString(),
};

function task(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? Math.random().toString(36),
    title: "task",
    tags: [],
    scheduled: "2026-08-26",
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    boardOrder: 0,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    subtasks: [],
    ...overrides,
  };
}

test("capacityCeilingMinutes derives from waking-hours settings, not a made-up number", () => {
  // 7 -> 23 is a 16h waking window, matching lib/tracking-day.ts's wakingWindow.
  assert.equal(capacityCeilingMinutes(SETTINGS, [999]), 16 * 60);
});

test("capacityCeilingMinutes falls back to the busiest day's own minutes when settings haven't loaded", () => {
  assert.equal(capacityCeilingMinutes(null, [30, 480, 120]), 480);
});

test("capacityCeilingMinutes never returns zero even with no settings and no planned minutes", () => {
  assert.equal(capacityCeilingMinutes(null, [0, 0, 0]), 1);
});

test("buildWeekPlan groups open tasks into today..today+6 and derives a capacity ratio per day", () => {
  const today = "2026-08-26";
  const tasks: Task[] = [
    task({ scheduled: today, minutes: 120, status: "open" }),
    task({ scheduled: today, minutes: 240, status: "open" }),
    task({ scheduled: "2026-08-27", minutes: 60, status: "open" }),
    // Outside the window — must not be counted.
    task({ scheduled: "2026-09-05", minutes: 999, status: "open" }),
    // Done tasks don't occupy capacity.
    task({ scheduled: today, minutes: 500, status: "done" }),
  ];

  const week = buildWeekPlan(tasks, today, SETTINGS);
  assert.equal(week.length, 7);
  assert.equal(week[0].date, today);
  assert.equal(week[0].plannedMinutes, 360);
  assert.equal(week[0].tasks.length, 2);
  // 360 minutes of a 16h (960min) ceiling.
  assert.equal(week[0].capacityRatio, 360 / 960);

  assert.equal(week[1].date, "2026-08-27");
  assert.equal(week[1].plannedMinutes, 60);

  for (let i = 2; i <= 6; i++) {
    assert.equal(week[i].plannedMinutes, 0);
    assert.equal(week[i].capacityRatio, 0);
  }
});

test("weekMetrics computes task count, planned time, overdue count and busiest day from real data", () => {
  const today = "2026-08-26";
  const tasks: Task[] = [
    task({ scheduled: today, minutes: 30, status: "open" }),
    task({ scheduled: "2026-08-27", minutes: 90, status: "open" }),
    task({ scheduled: "2026-08-27", minutes: 90, status: "open" }),
    // Overdue: scheduled before today, still open.
    task({ scheduled: "2026-08-20", minutes: 15, status: "open" }),
    task({ scheduled: "2026-08-21", minutes: 15, status: "open" }),
  ];

  const week = buildWeekPlan(tasks, today, SETTINGS);
  const metrics = weekMetrics(tasks, today, week);

  assert.equal(metrics.taskCount, 3);
  assert.equal(metrics.plannedMinutes, 210);
  assert.equal(metrics.overdueCount, 2);
  assert.equal(metrics.busiestDate, "2026-08-27");
});

test("weekMetrics uses the shared isOverdue predicate — a complex task isn't overdue until its finish date passes", () => {
  const today = "2026-08-26";
  const tasks: Task[] = [
    // Started yesterday, finishes Friday (well after today) — not overdue.
    task({
      scheduled: "2026-08-25",
      isComplex: true,
      finishDate: "2026-08-28",
      minutes: 60,
      status: "open",
    }),
    // Simple task scheduled before today — overdue.
    task({ scheduled: "2026-08-20", minutes: 15, status: "open" }),
  ];

  const week = buildWeekPlan(tasks, today, SETTINGS);
  const metrics = weekMetrics(tasks, today, week);

  assert.equal(metrics.overdueCount, 1);
});

test("buildWeekPlan exposes an uncapped trueCapacityRatio so over-capacity days can be detected", () => {
  const today = "2026-08-26";
  // 20h (1200min) of estimates against the 16h (960min) waking window.
  const tasks: Task[] = [task({ scheduled: today, minutes: 1200, status: "open" })];

  const week = buildWeekPlan(tasks, today, SETTINGS);

  assert.equal(week[0].plannedMinutes, 1200);
  // Capped ratio still saturates at 1 for bar width.
  assert.equal(week[0].capacityRatio, 1);
  // True ratio reveals the overcommitment.
  assert.equal(week[0].trueCapacityRatio, 1200 / 960);
  assert.ok(week[0].trueCapacityRatio > 1);
  assert.equal(week[0].ceilingIsProvisional, false);
});

test("buildWeekPlan marks the ceiling provisional when settings haven't loaded yet", () => {
  const today = "2026-08-26";
  const tasks: Task[] = [task({ scheduled: today, minutes: 60, status: "open" })];

  const week = buildWeekPlan(tasks, today, null);

  assert.equal(week[0].ceilingIsProvisional, true);
});
