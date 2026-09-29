import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST, PATCH } from "@/app/api/faltantes-obra/route";
import { getDbClient } from "@/lib/db";
import { useIsolatedTestDb } from "./test-db";

/**
 * P0-3 — FALTANTES DE OBRA, DE PUNTA A PUNTA CONTRA LA API REAL
 *
 * Reproduce EXACTAMENTE la secuencia de la QA del móvil, contra la misma ruta que
 * usa la pantalla y una base de datos real (aislada en memoria):
 *
 *   1. Dictar la frase obligatoria            -> 4 partidas con sus unidades
 *   2. Dictar "ya tengo las cajas y los tornillos"
 *   3. Preguntar "¿qué me falta para esta obra?" -> SOLO lo pendiente
 *   4. Salir, volver y refrescar (GET)         -> los datos siguen ahí
 *
 * Es la prueba que demuestra que el flujo NO es de pantalla: queda en la base de
 * datos asociado al `parte_id` de una obra real.
 */

useIsolatedTestDb();

const PARTE_ID = "parte-faltantes-qa";
const PARTE_NUM = "PT-FALTANTES-QA";

async function crearObra(): Promise<void> {
  const db = getDbClient();
  await db.execute({
    sql: `INSERT OR IGNORE INTO partes_trabajo (id, numero, fecha, cliente, estado)
          VALUES (?, ?, '2026-09-29', 'Juan Pérez', 'en_progreso')`,
    args: [PARTE_ID, PARTE_NUM],
  });
}

function peticionPost(texto: string, parteId = PARTE_ID) {
  return new NextRequest("http://localhost:3000/api/faltantes-obra", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parte_id: parteId, texto }),
  });
}

describe("FALTANTES DE OBRA — flujo completo por voz (P0-3)", () => {
  test("1. la frase obligatoria guarda las 4 partidas con producto, cantidad y unidad", async () => {
    await crearObra();
    const res = await POST(
      peticionPost(
        "Apunta que para este trabajo me faltan 20 metros de cable, dos cajas, diez tornillos y silicona."
      )
    );
    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.tipo, "agregar");
    assert.deepEqual(
      json.faltantes.map((f: { producto: string; cantidad: number; unidad: string; estado: string }) => [
        f.producto,
        f.cantidad,
        f.unidad,
        f.estado,
      ]),
      [
        ["Cable", 20, "m", "pendiente"],
        ["Caja", 2, "ud", "pendiente"],
        ["Tornillo", 10, "ud", "pendiente"],
        ["Silicona", 1, "ud", "pendiente"],
      ]
    );
    // Queda asociado a la obra real.
    assert.ok(json.faltantes.every((f: { parteId: string }) => f.parteId === PARTE_ID));
  });

  test("2. 'ya tengo las cajas y los tornillos' cambia SÓLO esos dos estados", async () => {
    const res = await POST(peticionPost("Ya tengo las cajas y los tornillos."));
    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.tipo, "conseguido");
    const porProducto = Object.fromEntries(
      json.faltantes.map((f: { producto: string; estado: string }) => [f.producto, f.estado])
    );
    assert.equal(porProducto.Caja, "conseguido");
    assert.equal(porProducto.Tornillo, "conseguido");
    assert.equal(porProducto.Cable, "pendiente");
    assert.equal(porProducto.Silicona, "pendiente");
  });

  test("3. '¿qué me falta para esta obra?' responde SOLO lo pendiente", async () => {
    const res = await POST(peticionPost("¿Qué me falta para esta obra?"));
    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.tipo, "consulta");
    assert.deepEqual(json.resumenPendientes, ["20 m de cable", "1 ud de silicona"]);
    assert.equal(json.respuesta, "Te falta 20 m de cable y 1 ud de silicona.");
  });

  test("4. salir, volver y refrescar (GET) devuelve exactamente lo mismo", async () => {
    const res = await GET(new NextRequest(`http://localhost:3000/api/faltantes-obra?parte_id=${PARTE_ID}`));
    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.faltantes.length, 4);
    assert.deepEqual(json.resumenPendientes, ["20 m de cable", "1 ud de silicona"]);
    const porProducto = Object.fromEntries(
      json.faltantes.map((f: { producto: string; cantidad: number; estado: string }) => [
        f.producto,
        `${f.cantidad}:${f.estado}`,
      ])
    );
    assert.deepEqual(porProducto, {
      Cable: "20:pendiente",
      Caja: "2:conseguido",
      Tornillo: "10:conseguido",
      Silicona: "1:pendiente",
    });
  });

  test("5. volver a dictar lo mismo SUMA cantidad y no duplica la partida", async () => {
    const res = await POST(peticionPost("Me faltan 5 metros de cable y una caja"));
    assert.equal(res.status, 200);
    const json = await res.json();

    const cable = json.faltantes.filter((f: { producto: string }) => f.producto === "Cable");
    assert.equal(cable.length, 1, "no debe haber dos partidas de Cable");
    assert.equal(cable[0].cantidad, 25);
    assert.equal(cable[0].estado, "pendiente");
    // La caja vuelve a "pendiente" porque ha vuelto a faltar.
    const caja = json.faltantes.find((f: { producto: string }) => f.producto === "Caja");
    assert.equal(caja.estado, "pendiente");
    assert.equal(caja.cantidad, 3);
  });

  test("6. el estado se puede corregir a mano (PATCH) y persiste", async () => {
    const listado = await GET(new NextRequest(`http://localhost:3000/api/faltantes-obra?parte_id=${PARTE_ID}`));
    const datos = await listado.json();
    const silicona = datos.faltantes.find((f: { producto: string }) => f.producto === "Silicona");

    const res = await PATCH(
      new NextRequest("http://localhost:3000/api/faltantes-obra", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: silicona.id, estado: "conseguido" }),
      })
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    const actualizada = json.faltantes.find((f: { id: string }) => f.id === silicona.id);
    assert.equal(actualizada.estado, "conseguido");
  });

  test("7. una obra que no existe se rechaza: los faltantes siempre son de una obra real", async () => {
    const res = await POST(peticionPost("Me faltan dos cajas", "parte-que-no-existe"));
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /obra/i);
  });

  test("8. un dictado sin materiales no se guarda como si lo fuera", async () => {
    const res = await POST(peticionPost("Hola buenos días"));
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.tipo, "desconocido");
  });
});
