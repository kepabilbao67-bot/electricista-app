import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDbClient, initializeDatabase } from "@/lib/db";
import {
  claveProducto,
  formatearPendientes,
  interpretarFaltantes,
  respuestaPendientes,
  type FaltanteObra,
  type PartidaFaltante,
} from "@/lib/faltantes-obra";

/**
 * ELECTRICISTA360 — FALTANTES DE OBRA (P0-3)
 *
 * Los materiales que faltan para una obra/parte REAL, dictados por voz y
 * guardados en la base de datos.
 *
 *   GET    /api/faltantes-obra?parte_id=…      → lista de la obra
 *   POST   /api/faltantes-obra                 → interpreta el dictado y aplica
 *   PATCH  /api/faltantes-obra                 → cambia el estado de una partida
 *   DELETE /api/faltantes-obra?id=…            → borra una partida
 *
 * El dictado se interpreta con `src/lib/faltantes-obra.ts` (lógica pura,
 * probada): la misma función que usa la pantalla, así que no hay dos verdades.
 *
 * SEGURIDAD: la puerta de sesión es `src/proxy.ts` (toda la app pasa por ella);
 * esta ruta no expone datos de otras obras porque siempre se filtra por
 * `parte_id` y se valida que la parte exista.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStore(cuerpo: unknown, status = 200): NextResponse {
  return NextResponse.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });
}

function aFaltante(fila: Record<string, unknown>): FaltanteObra {
  return {
    id: String(fila.id),
    parteId: String(fila.parte_id),
    producto: String(fila.producto),
    cantidad: Number(fila.cantidad ?? 1),
    unidad: String(fila.unidad ?? "ud"),
    estado: fila.estado === "conseguido" ? "conseguido" : "pendiente",
  };
}

async function leerFaltantes(parteId: string): Promise<FaltanteObra[]> {
  const db = getDbClient();
  const resultado = await db.execute({
    sql: "SELECT * FROM faltantes_obra WHERE parte_id = ? ORDER BY created_at ASC",
    args: [parteId],
  });
  return resultado.rows.map((fila) => aFaltante(fila as Record<string, unknown>));
}

function pendientesDe(faltantes: FaltanteObra[]): PartidaFaltante[] {
  return faltantes
    .filter((f) => f.estado === "pendiente")
    .map((f) => ({ producto: f.producto, cantidad: f.cantidad, unidad: f.unidad }));
}

async function parteExiste(parteId: string): Promise<boolean> {
  const db = getDbClient();
  const resultado = await db.execute({
    sql: "SELECT id FROM partes_trabajo WHERE id = ? LIMIT 1",
    args: [parteId],
  });
  return resultado.rows.length > 0;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parteId = (request.nextUrl.searchParams.get("parte_id") ?? "").trim();
  if (!parteId) return noStore({ error: "Falta la obra (parte_id)." }, 400);

  try {
    await initializeDatabase();
    const faltantes = await leerFaltantes(parteId);
    const pendientes = pendientesDe(faltantes);
    return noStore({
      parteId,
      faltantes,
      pendientes,
      respuesta: respuestaPendientes(pendientes),
      resumenPendientes: formatearPendientes(pendientes),
    });
  } catch {
    return noStore({ error: "No se pudieron leer los faltantes de la obra." }, 500);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let cuerpo: { parte_id?: unknown; texto?: unknown };
  try {
    cuerpo = (await request.json()) as { parte_id?: unknown; texto?: unknown };
  } catch {
    return noStore({ error: "Solicitud no válida." }, 400);
  }

  const parteId = typeof cuerpo.parte_id === "string" ? cuerpo.parte_id.trim() : "";
  const texto = typeof cuerpo.texto === "string" ? cuerpo.texto.trim() : "";
  if (!parteId) return noStore({ error: "Selecciona la obra antes de dictar." }, 400);
  if (!texto) return noStore({ error: "No se ha dictado nada." }, 400);

  const interpretacion = interpretarFaltantes(texto);
  if (interpretacion.tipo === "desconocido") {
    return noStore(
      {
        error:
          "No se han reconocido materiales. Prueba con: «me faltan 20 metros de cable y dos cajas».",
        tipo: interpretacion.tipo,
      },
      400
    );
  }

  try {
    await initializeDatabase();
    if (!(await parteExiste(parteId))) {
      return noStore({ error: "La obra seleccionada ya no existe." }, 400);
    }

    const db = getDbClient();
    const ahora = new Date().toISOString();
    let aplicado = "";

    if (interpretacion.tipo === "agregar") {
      const existentes = await leerFaltantes(parteId);
      let nuevas = 0;
      for (const partida of interpretacion.partidas) {
        const clave = claveProducto(partida.producto);
        const yaEsta = existentes.find(
          (f) => claveProducto(f.producto) === clave && f.unidad === partida.unidad
        );
        if (yaEsta) {
          // Ya estaba apuntado: se SUMA la cantidad y vuelve a "pendiente" (si
          // vuelve a faltar, es que no se consiguió).
          await db.execute({
            sql: "UPDATE faltantes_obra SET cantidad = ?, estado = 'pendiente', origen_texto = ?, updated_at = ? WHERE id = ?",
            args: [yaEsta.cantidad + partida.cantidad, texto, ahora, yaEsta.id],
          });
        } else {
          await db.execute({
            sql: `INSERT INTO faltantes_obra (id, parte_id, producto, cantidad, unidad, estado, origen_texto, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?, ?)`,
            args: [uuidv4(), parteId, partida.producto, partida.cantidad, partida.unidad, texto, ahora, ahora],
          });
          nuevas += 1;
        }
      }
      aplicado = `apuntado:${nuevas}`;
    } else if (interpretacion.tipo === "conseguido") {
      const existentes = await leerFaltantes(parteId);
      const claves = new Set(interpretacion.productos.map(claveProducto));
      for (const faltante of existentes) {
        if (claves.has(claveProducto(faltante.producto))) {
          await db.execute({
            sql: "UPDATE faltantes_obra SET estado = 'conseguido', updated_at = ? WHERE id = ?",
            args: [ahora, faltante.id],
          });
        }
      }
      aplicado = `conseguido:${interpretacion.productos.length}`;
    } else {
      // Consulta: no se escribe nada, sólo se responde lo pendiente.
      aplicado = "consulta";
    }

    const faltantes = await leerFaltantes(parteId);
    const pendientes = pendientesDe(faltantes);
    return noStore({
      tipo: interpretacion.tipo,
      aplicado,
      parteId,
      faltantes,
      pendientes,
      respuesta: respuestaPendientes(pendientes),
      resumenPendientes: formatearPendientes(pendientes),
      interpretacion,
    });
  } catch {
    return noStore({ error: "No se pudieron guardar los faltantes de la obra." }, 500);
  }
}

/** Cambia el estado de una partida (la casilla de la pantalla). */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  let cuerpo: { id?: unknown; estado?: unknown };
  try {
    cuerpo = (await request.json()) as { id?: unknown; estado?: unknown };
  } catch {
    return noStore({ error: "Solicitud no válida." }, 400);
  }

  const id = typeof cuerpo.id === "string" ? cuerpo.id.trim() : "";
  const estado = cuerpo.estado === "conseguido" ? "conseguido" : cuerpo.estado === "pendiente" ? "pendiente" : "";
  if (!id || !estado) return noStore({ error: "Datos no válidos." }, 400);

  try {
    await initializeDatabase();
    const db = getDbClient();
    await db.execute({
      sql: "UPDATE faltantes_obra SET estado = ?, updated_at = ? WHERE id = ?",
      args: [estado, new Date().toISOString(), id],
    });
    const resultado = await db.execute({
      sql: "SELECT parte_id FROM faltantes_obra WHERE id = ? LIMIT 1",
      args: [id],
    });
    const parteId = resultado.rows.length > 0 ? String(resultado.rows[0].parte_id) : "";
    const faltantes = parteId ? await leerFaltantes(parteId) : [];
    return noStore({ ok: true, parteId, faltantes, pendientes: pendientesDe(faltantes) });
  } catch {
    return noStore({ error: "No se pudo cambiar el estado." }, 500);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const id = (request.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) return noStore({ error: "Falta el identificador." }, 400);

  try {
    await initializeDatabase();
    const db = getDbClient();
    const resultado = await db.execute({
      sql: "SELECT parte_id FROM faltantes_obra WHERE id = ? LIMIT 1",
      args: [id],
    });
    const parteId = resultado.rows.length > 0 ? String(resultado.rows[0].parte_id) : "";
    await db.execute({ sql: "DELETE FROM faltantes_obra WHERE id = ?", args: [id] });
    const faltantes = parteId ? await leerFaltantes(parteId) : [];
    return noStore({ ok: true, parteId, faltantes, pendientes: pendientesDe(faltantes) });
  } catch {
    return noStore({ error: "No se pudo borrar la partida." }, 500);
  }
}
