import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveLuxPointPosition } from "../luz360/heatmap";

describe("Luz360 heatmap", () => {
  test("respeta coordenadas reales normalizadas 0-100", () => {
    const position = resolveLuxPointPosition({ id: "p1", lux: 500, x: 25, y: 75 }, 0, 1);
    assert.deepEqual(position, { left: 25, top: 75 });
  });

  test("limita coordenadas al área visible", () => {
    const position = resolveLuxPointPosition({ id: "p1", lux: 500, x: 0, y: 100 }, 0, 1);
    assert.deepEqual(position, { left: 4, top: 94 });
  });

  test("sin coordenadas distribuye puntos en rejilla", () => {
    const first = resolveLuxPointPosition({ id: "p1", lux: 100 }, 0, 4);
    const second = resolveLuxPointPosition({ id: "p2", lux: 100 }, 1, 4);
    assert.ok(first.left < second.left);
    assert.equal(first.top, second.top);
  });
});
