import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validatePartePayload } from "../validate-parte";

const BASE = { cliente: "Demo", fecha: "2026-08-01", trabajos: [], materiales: [] };

function withTrabajo(precio: string | number | undefined) {
  return { ...BASE, trabajos: [{ descripcion: "Instalacion", cantidad: "1", precio_unitario: precio }] };
}

function withMaterial(precio: string | number | undefined) {
  return { ...BASE, materiales: [{ nombre_material: "Cable", descripcion: "2.5mm", cantidad: "1", precio_unitario: precio }] };
}

describe("validatePartePayload - precio unitario", () => {
  // Rechazados
  test("trabajo con precio vacio es rechazado", () => {
    assert.ok(validatePartePayload(withTrabajo("")) !== null);
  });
  test("trabajo con precio espacios es rechazado", () => {
    assert.ok(validatePartePayload(withTrabajo("   ")) !== null);
  });
  test("trabajo con precio 0 es rechazado", () => {
    assert.ok(validatePartePayload(withTrabajo("0")) !== null);
  });
  test("trabajo con precio 0 (number) es rechazado", () => {
    assert.ok(validatePartePayload(withTrabajo(0)) !== null);
  });
  test("trabajo con precio 0.01 es rechazado", () => {
    assert.ok(validatePartePayload(withTrabajo("0.01")) !== null);
  });
  test("trabajo con precio 0,01 es rechazado", () => {
    assert.ok(validatePartePayload(withTrabajo("0,01")) !== null);
  });
  test("trabajo con precio 0.50 es rechazado", () => {
    assert.ok(validatePartePayload(withTrabajo("0.50")) !== null);
  });
  test("trabajo con precio -1 es rechazado", () => {
    assert.ok(validatePartePayload(withTrabajo("-1")) !== null);
  });
  test("trabajo con precio 1.50 es rechazado sin truncarse", () => {
    const result = validatePartePayload(withTrabajo("1.50"));
    assert.ok(result !== null);
    assert.ok(result.includes("entero"));
  });
  test("trabajo con precio 1,50 es rechazado", () => {
    assert.ok(validatePartePayload(withTrabajo("1,50")) !== null);
  });
  test("trabajo con precio undefined es rechazado", () => {
    assert.ok(validatePartePayload(withTrabajo(undefined)) !== null);
  });

  // Aceptados
  test("trabajo con precio 1 es aceptado", () => {
    assert.equal(validatePartePayload(withTrabajo("1")), null);
  });
  test("trabajo con precio 1 (number) es aceptado", () => {
    assert.equal(validatePartePayload(withTrabajo(1)), null);
  });
  test("trabajo con precio 2 es aceptado", () => {
    assert.equal(validatePartePayload(withTrabajo("2")), null);
  });
  test("trabajo con precio 25 es aceptado", () => {
    assert.equal(validatePartePayload(withTrabajo("25")), null);
  });

  // Material - misma regla
  test("material con precio vacio es rechazado", () => {
    assert.ok(validatePartePayload(withMaterial("")) !== null);
  });
  test("material con precio 0 es rechazado", () => {
    assert.ok(validatePartePayload(withMaterial("0")) !== null);
  });
  test("material con precio 1.50 es rechazado", () => {
    assert.ok(validatePartePayload(withMaterial("1.50")) !== null);
  });
  test("material con precio 1 es aceptado", () => {
    assert.equal(validatePartePayload(withMaterial("1")), null);
  });
  test("material con precio 2 es aceptado", () => {
    assert.equal(validatePartePayload(withMaterial("2")), null);
  });

  // Filas vacias ignoradas
  test("fila de trabajo completamente vacia no produce error", () => {
    const payload = { ...BASE, trabajos: [{ descripcion: "", nombre_trabajo: "", cantidad: "", precio_unitario: "" }] };
    assert.equal(validatePartePayload(payload), null);
  });
  test("fila de material completamente vacia no produce error", () => {
    const payload = { ...BASE, materiales: [{ nombre_material: "", descripcion: "", cantidad: "", precio_unitario: "" }] };
    assert.equal(validatePartePayload(payload), null);
  });

  // Ante error no se escribe (esto se demuestra por el return antes de batch en route.ts)
  test("mensaje de error incluye identificador de fila", () => {
    const result = validatePartePayload(withTrabajo("0"));
    assert.ok(result!.includes("Fila de trabajo 1"));
  });
});
