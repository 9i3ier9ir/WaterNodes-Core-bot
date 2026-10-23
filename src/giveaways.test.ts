import assert from "node:assert/strict";
import test from "node:test";
import { parseDuration } from "./giveaways.js";

test("parses supported giveaway durations", () => {
  assert.equal(parseDuration("30m"), 30 * 60_000);
  assert.equal(parseDuration("12H"), 12 * 60 * 60_000);
  assert.equal(parseDuration("7d"), 7 * 24 * 60 * 60_000);
});

test("rejects durations outside the supported range", () => {
  assert.equal(parseDuration("30s"), undefined);
  assert.equal(parseDuration("0m"), undefined);
  assert.equal(parseDuration("31d"), undefined);
  assert.equal(parseDuration("one day"), undefined);
});