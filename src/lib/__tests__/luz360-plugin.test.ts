import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { runLuz360Plugins } from "../luz360/plugin";

describe("Luz360 plugin gate", () => {
  test("acepta una sesión profesional válida", () => {
    const result = runLuz360Plugins({
      readings: [{ id: "p1", lux: 500, x: 25, y: 75 }],
      minLux: 300,
      method: "manual-luxmeter",
    });
    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
  });

  test("falla cerrado con lectura inválida o coordenadas fuera de rango", () => {
    const result = runLuz360Plugins({
      readings: [{ id: "p1", lux: 250, x: 101, y: 50 }],
      minLux: 200,
      method: "manual-luxmeter",
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((issue) => issue.plugin === "reading-integrity"));
  });

  test("el sensor del móvil queda marcado como orientativo", () => {
    const result = runLuz360Plugins({
      readings: [{ id: "p1", lux: 300 }],
      minLux: 200,
      method: "phone-orientative",
    });
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some((issue) => issue.plugin === "measurement-method"));
    assert.ok(result.warnings.some((issue) => issue.plugin === "session-coverage"));
  });

  test("avisa de cobertura limitada sin bloquear el guardado", () => {
    const result = runLuz360Plugins({
      readings: [
        { id: "p1", lux: 300 },
        { id: "p2", lux: 320 },
        { id: "p3", lux: 310 },
      ],
      minLux: 200,
      method: "manual-luxmeter",
    });
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some((issue) => issue.plugin === "session-coverage"));
  });
});
