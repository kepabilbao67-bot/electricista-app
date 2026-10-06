import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { calculateLuxSession } from "../luz360/calculation";

describe("Luz360 calculation engine", () => {
  test("calcula media, extremos, uniformidad y cumplimiento", () => {
    const result = calculateLuxSession(
      [
        { id: "1", lux: 500 },
        { id: "2", lux: 600 },
        { id: "3", lux: 700 },
      ],
      { minLux: 500 },
    );

    assert.equal(result.averageLux, 600);
    assert.equal(result.minLux, 500);
    assert.equal(result.maxLux, 700);
    assert.equal(result.uniformity, 0.833);
    assert.equal(result.deficientPoints, 0);
    assert.equal(result.compliancePercentage, 100);
    assert.equal(result.passed, true);
  });

  test("falla cerrado cuando hay puntos por debajo del objetivo", () => {
    const result = calculateLuxSession(
      [
        { id: "1", lux: 500 },
        { id: "2", lux: 180 },
      ],
      { minLux: 200 },
    );

    assert.equal(result.deficientPoints, 1);
    assert.equal(result.compliancePercentage, 50);
    assert.equal(result.passed, false);
  });

  test("sesión vacía no se declara conforme", () => {
    const result = calculateLuxSession([], { minLux: 100 });
    assert.equal(result.totalReadings, 0);
    assert.equal(result.passed, false);
  });
});
