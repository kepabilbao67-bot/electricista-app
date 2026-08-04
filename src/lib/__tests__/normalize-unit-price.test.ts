import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUnitPriceInput } from "../normalize-unit-price";

// Empty → allowed
test("empty string returns empty", () => {
  assert.equal(normalizeUnitPriceInput(""), "");
});

// Whitespace → rejected
test("spaces returns null", () => {
  assert.equal(normalizeUnitPriceInput("   "), null);
});

// Browser arrow decimals (0.01..0.99) → normalize to "1"
test("0.01 normalizes to 1", () => {
  assert.equal(normalizeUnitPriceInput("0.01"), "1");
});
test("0.02 normalizes to 1", () => {
  assert.equal(normalizeUnitPriceInput("0.02"), "1");
});
test("0.99 normalizes to 1", () => {
  assert.equal(normalizeUnitPriceInput("0.99"), "1");
});
test("0.5 normalizes to 1", () => {
  assert.equal(normalizeUnitPriceInput("0.5"), "1");
});

// Valid integers
test("1 returns 1", () => {
  assert.equal(normalizeUnitPriceInput("1"), "1");
});
test("2 returns 2", () => {
  assert.equal(normalizeUnitPriceInput("2"), "2");
});
test("3 returns 3", () => {
  assert.equal(normalizeUnitPriceInput("3"), "3");
});
test("25 returns 25", () => {
  assert.equal(normalizeUnitPriceInput("25"), "25");
});
test("100 returns 100", () => {
  assert.equal(normalizeUnitPriceInput("100"), "100");
});

// Zero → rejected
test("0 returns null", () => {
  assert.equal(normalizeUnitPriceInput("0"), null);
});

// Negatives → rejected
test("-1 returns null", () => {
  assert.equal(normalizeUnitPriceInput("-1"), null);
});
test("-5 returns null", () => {
  assert.equal(normalizeUnitPriceInput("-5"), null);
});

// Decimals >= 1 → rejected (not truncated)
test("1.5 returns null", () => {
  assert.equal(normalizeUnitPriceInput("1.5"), null);
});
test("2.3 returns null", () => {
  assert.equal(normalizeUnitPriceInput("2.3"), null);
});

// Non-numeric → rejected
test("text returns null", () => {
  assert.equal(normalizeUnitPriceInput("abc"), null);
});
test("1,50 (comma) returns null", () => {
  assert.equal(normalizeUnitPriceInput("1,50"), null);
});

// Infinity → rejected
test("Infinity returns null", () => {
  assert.equal(normalizeUnitPriceInput("Infinity"), null);
});

// Sequence simulation: empty → arrow → 0.01 → normalized to 1, then 2, 3
test("arrow sequence: 0.01 → 1, then 2, then 3", () => {
  assert.equal(normalizeUnitPriceInput("0.01"), "1");
  assert.equal(normalizeUnitPriceInput("2"), "2");
  assert.equal(normalizeUnitPriceInput("3"), "3");
});
