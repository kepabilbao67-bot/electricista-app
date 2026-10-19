import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePartePayload, safeNum } from "../validate-parte";
const base = { cliente: "Prueba", fecha: "2026-10-18" };
test("work and material prices accept cents and both separators", () => {
  for (const price of ["0.01", "0,50", "1.50", "1,70", 1.5, 25]) {
    assert.equal(validatePartePayload({ ...base, trabajos: [{ descripcion: "Trabajo", cantidad: 2, precio_unitario: price }] }), null);
    assert.equal(validatePartePayload({ ...base, materiales: [{ nombre_material: "Cable", cantidad: 2, precio_unitario: price }] }), null);
  }
});
test("used rows reject missing, zero, negative and malformed prices", () => {
  for (const price of [undefined, "", " ", 0, "-1", "1.234", "1.5abc", "Infinity"]) {
    assert.notEqual(validatePartePayload({ ...base, trabajos: [{ descripcion: "Trabajo", cantidad: 1, precio_unitario: price }] }), null);
    assert.notEqual(validatePartePayload({ ...base, materiales: [{ nombre_material: "Cable", cantidad: 1, precio_unitario: price }] }), null);
  }
});
test("decimal subtotals and discount limits preserve cents", () => {
  const trabajos = [{ descripcion: "Trabajo", cantidad: 2, precio_unitario: "1,50" }];
  const materiales = [{ nombre_material: "Cable", cantidad: 1, precio_unitario: "1,70" }];
  const subtotal = trabajos.reduce((sum, row) => sum + safeNum(row.cantidad) * safeNum(row.precio_unitario), 0) +
    materiales.reduce((sum, row) => sum + safeNum(row.cantidad) * safeNum(row.precio_unitario), 0);
  assert.equal(subtotal, 4.7);
  assert.equal((subtotal * 1.21).toFixed(2), "5.69");
  assert.equal(validatePartePayload({ ...base, trabajos, materiales, descuento: 4.7 }), null);
  assert.notEqual(validatePartePayload({ ...base, trabajos, materiales, descuento: 4.71 }), null);
});
test("unused rows remain optional", () => {
  assert.equal(validatePartePayload({ ...base, trabajos: [{ descripcion: "", precio_unitario: "" }] }), null);
});
