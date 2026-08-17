import assert from "node:assert/strict";
import test from "node:test";
import { dayIndexFromX, resolveTimelineDrag } from "../lib/useTimelineDrag";

test("move: shifts a simple task's scheduled day only", () => {
  const { preview, patch } = resolveTimelineDrag(
    "move",
    { scheduled: "2026-08-14", isComplex: false },
    "2026-08-16",
  );
  assert.deepEqual(preview, { scheduled: "2026-08-16", finishDate: undefined });
  assert.deepEqual(patch, { scheduled: "2026-08-16" });
});

test("move: is a no-op when dropped back on the same day", () => {
  const { patch } = resolveTimelineDrag("move", { scheduled: "2026-08-14", isComplex: false }, "2026-08-14");
  assert.equal(patch, null);
});

test("move: carries a complex task's finish date by the same delta", () => {
  const { preview, patch } = resolveTimelineDrag(
    "move",
    { scheduled: "2026-08-14", isComplex: true, finishDate: "2026-08-17" },
    "2026-08-16",
  );
  assert.deepEqual(preview, { scheduled: "2026-08-16", finishDate: "2026-08-19" });
  assert.deepEqual(patch, { scheduled: "2026-08-16", finishDate: "2026-08-19" });
});

test("move: preserves a span that starts before the visible window (real dates, not clamped ones)", () => {
  // The task really starts 2026-08-10, well before whatever window the bar is clamped to on screen.
  const { patch } = resolveTimelineDrag(
    "move",
    { scheduled: "2026-08-10", isComplex: true, finishDate: "2026-08-20" },
    "2026-08-12",
  );
  // A 2-day move should shift the 10-day span by exactly 2 days, not truncate it to what was visible.
  assert.deepEqual(patch, { scheduled: "2026-08-12", finishDate: "2026-08-22" });
});

test("resize-end: turns a simple task into a complex one", () => {
  const { preview, patch } = resolveTimelineDrag(
    "resize-end",
    { scheduled: "2026-08-14", isComplex: false },
    "2026-08-16",
  );
  assert.deepEqual(preview, { scheduled: "2026-08-14", finishDate: "2026-08-16" });
  assert.deepEqual(patch, { isComplex: true, finishDate: "2026-08-16" });
});

test("resize-end: dragged back onto the start day reverts to a single-day task", () => {
  const { preview, patch } = resolveTimelineDrag(
    "resize-end",
    { scheduled: "2026-08-14", isComplex: true, finishDate: "2026-08-18" },
    "2026-08-14",
  );
  assert.deepEqual(preview, { scheduled: "2026-08-14", finishDate: undefined });
  assert.deepEqual(patch, { isComplex: false });
});

test("resize-end: dragged past the start day (before it) also reverts", () => {
  const { patch } = resolveTimelineDrag(
    "resize-end",
    { scheduled: "2026-08-14", isComplex: true, finishDate: "2026-08-18" },
    "2026-08-12",
  );
  assert.deepEqual(patch, { isComplex: false });
});

test("resize-end: dropping on the current finish day is a no-op", () => {
  const { patch } = resolveTimelineDrag(
    "resize-end",
    { scheduled: "2026-08-14", isComplex: true, finishDate: "2026-08-18" },
    "2026-08-18",
  );
  assert.equal(patch, null);
});

test("resize-start: moves the start day, leaving finishDate untouched", () => {
  const { preview, patch } = resolveTimelineDrag(
    "resize-start",
    { scheduled: "2026-08-14", isComplex: true, finishDate: "2026-08-18" },
    "2026-08-12",
  );
  assert.deepEqual(preview, { scheduled: "2026-08-12", finishDate: "2026-08-18" });
  assert.deepEqual(patch, { scheduled: "2026-08-12" });
});

test("resize-start: dragged past the end day clamps visually but sends nothing", () => {
  const { preview, patch } = resolveTimelineDrag(
    "resize-start",
    { scheduled: "2026-08-14", isComplex: true, finishDate: "2026-08-18" },
    "2026-08-20",
  );
  assert.deepEqual(preview, { scheduled: "2026-08-18", finishDate: "2026-08-18" });
  assert.equal(patch, null);
});

test("resize-start: on a simple task, dragging past its own day is a no-op", () => {
  const { patch } = resolveTimelineDrag(
    "resize-start",
    { scheduled: "2026-08-14", isComplex: false },
    "2026-08-16",
  );
  assert.equal(patch, null);
});

test("resize-start: on a simple task, dragging earlier just moves it", () => {
  const { patch } = resolveTimelineDrag(
    "resize-start",
    { scheduled: "2026-08-14", isComplex: false },
    "2026-08-12",
  );
  assert.deepEqual(patch, { scheduled: "2026-08-12" });
});

test("resize-start: dropped back on the same start day is a no-op", () => {
  const { patch } = resolveTimelineDrag(
    "resize-start",
    { scheduled: "2026-08-14", isComplex: true, finishDate: "2026-08-18" },
    "2026-08-14",
  );
  assert.equal(patch, null);
});

test("dayIndexFromX: maps a clientX across the grid width to a clamped day index", () => {
  const rect = { left: 100, width: 500 };
  assert.equal(dayIndexFromX(100, rect, 5), 0);
  assert.equal(dayIndexFromX(150, rect, 5), 0);
  assert.equal(dayIndexFromX(200, rect, 5), 1);
  assert.equal(dayIndexFromX(599, rect, 5), 4);
});

test("dayIndexFromX: clamps out-of-bounds pointer positions to the grid edges", () => {
  const rect = { left: 100, width: 500 };
  assert.equal(dayIndexFromX(-50, rect, 5), 0);
  assert.equal(dayIndexFromX(10_000, rect, 5), 4);
});

test("dayIndexFromX: degenerate rect (zero width) never divides by zero", () => {
  assert.equal(dayIndexFromX(50, { left: 0, width: 0 }, 5), 0);
});
