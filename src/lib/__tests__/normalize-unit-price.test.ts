import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUnitPriceInput } from "../normalize-unit-price";
test("preserves decimal entry sequences and cents", () => {
  for (const [input, expected] of [["", ""], ["0", "0"], ["1", "1"], ["1,", "1."], ["1,5", "1.5"], ["1,50", "1.50"], ["1,49", "1.49"], ["1,61", "1.61"], ["129,46", "129.46"], ["1.70", "1.70"], ["0,01", "0.01"], ["0.50", "0.50"], [".5", "0.5"]]) {
    assert.equal(normalizeUnitPriceInput(input), expected, input);
  }
});
test("rejects malformed prices without truncation", () => {
  for (const input of [" ", "-1", "1.234", "1,2.3", "1e3", "abc", "Infinity", "1.50abc"]) {
    assert.equal(normalizeUnitPriceInput(input), null, input);
  }
});
