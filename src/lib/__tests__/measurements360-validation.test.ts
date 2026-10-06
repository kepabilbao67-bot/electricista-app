import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateCalculatorInput } from "../measurements360/validation";

describe("Mediciones360 calculator validation", () => {
  test("bloquea perímetros incompletos o a cero", () => {
    assert.equal(validateCalculatorInput("perimeter", { a: "0", b: "2", c: "", reserve: "10" }).ok, false);
    assert.equal(validateCalculatorInput("perimeter", { a: "3", b: "", c: "", reserve: "10" }).ok, false);
  });

  test("acepta coma decimal", () => {
    assert.equal(validateCalculatorInput("area", { a: "2,5", b: "4", c: "", reserve: "10" }).ok, true);
  });

  test("volumen exige las tres medidas", () => {
    assert.equal(validateCalculatorInput("volume", { a: "2", b: "3", c: "0", reserve: "10" }).ok, false);
    assert.equal(validateCalculatorInput("volume", { a: "2", b: "3", c: "4", reserve: "10" }).ok, true);
  });

  test("cable permite reserva cero pero exige longitud positiva", () => {
    assert.equal(validateCalculatorInput("cable", { a: "25", b: "", c: "", reserve: "0" }).ok, true);
    assert.equal(validateCalculatorInput("cable", { a: "", b: "", c: "", reserve: "10" }).ok, false);
  });

  test("suma exige al menos una longitud positiva", () => {
    assert.equal(validateCalculatorInput("sum", { a: "0", b: "0", c: "0", reserve: "10" }).ok, false);
    assert.equal(validateCalculatorInput("sum", { a: "0", b: "1.5", c: "0", reserve: "10" }).ok, true);
  });
});
