import assert from "node:assert/strict";
import test from "node:test";
import { fmt } from "../lib/format";

test("durations under a day read the way they always did", () => {
  assert.equal(fmt(0), "0m");
  assert.equal(fmt(45), "45m");
  assert.equal(fmt(60), "1h");
  assert.equal(fmt(150), "2h 30m");
  assert.equal(fmt(1439), "23h 59m");
});

test("past a day it rolls over instead of printing raw hours", () => {
  assert.equal(fmt(1440), "1d");
  assert.equal(fmt(1500), "1d 1h");
  assert.equal(fmt(4320), "3d", "matches what `3d` means to quick-add");
  assert.equal(fmt(60 * 24 * 30), "30d", "a month-long miniproject");
});

test("only the two most significant units survive", () => {
  assert.equal(fmt(1501), "1d 1h", "the stray minute is dropped, not shown as 1d 1h 1m");
  assert.equal(fmt(1441), "1d 1m", "with no whole hour, minutes are still the second unit");
});
