/**
 * Voz 360 — Motor autónomo para Electricista360
 *
 * Reemplaza el proxy a localhost:3088 por un motor local que:
 * 1. Normaliza vocabulario eléctrico
 * 2. Detecta el intent del input (presupuesto, consulta, parte, factura, agenda)
 * 3. Ejecuta contra la BD local de Electricista360
 * 4. Gestiona el ciclo borrador → confirmación → guardado
 * 5. Devuelve { answer, draft, totals, pending_action } en el formato que espera la UI
 *
 * No depende de ningún servidor externo.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase, generateBudgetNumber } from "@/lib/db";
import { electricistaDomainAdapter } from "@/lib/assistant/electricista-adapter";
import type {
  Voice360Draft,
  Voice360Item,
  Voice360PendingAction,
  Voice360Totals,
} from "@/lib/assistant/types";

export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────────────────────
// Número en texto → dígito
// ────────────────────────────────────────────────────────────────────────────
const WORD_NUMBERS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11,
  doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20,
  veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50,
};

function parseNumber(raw: string): number | null {
  const lower = raw.toLowerCase().trim();
  if (WORD_NUMBERS[lower] !== undefined) return WORD_NUMBERS[lower];
  const n = Number(lower.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Normalización + intent detector
// ────────────────────────────────────────────────────────────────────────────

type Intent =
  | "budget_create"
  | "budget_add_item"
  | "budget_modify_item"
  | "budget_set_client"
  | "budget_confirm"
  | "budget_cancel"
  | "budget_query"
  | "client_query"
  | "invoice_query"
  | "parte_query"
  | "schedule_query"
  | "catalog_query"
  | "general";

function detectIntent(text: string): Intent {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Confirmación / cancelación
  if (/\b(si\b|confirma|confirmar|guarda|guardar|acepto|ok)\b/.test(t)) return "budget_confirm";
  if (/\b(no\b|cancela|cancelar|descarta|descartar|borra|borrar el borrador)\b/.test(t)) return "budget_cancel";

  // Presupuesto
  if (/\b(hazme|crea|nuevo|hacer|prepara|genera)\b.*(presupuesto|presupu|budget)/.test(t)) return "budget_create";
  if (/\b(presupuesto|presupu|budget)\b.*(de|para)\b/.test(t)) return "budget_create";
  if (
    /\b(a[ñn]ade|agrega|incluye|pon|meter|mete|añade)\b.*(l[ií]nea|item|partida|enchufe|cable|magnetot|diferencial|enchufe|luz|punto)/.test(t) ||
    /\b(a[ñn]ade|agrega|incluye|pon)\b.*(unidades|uds|metros|m\b|cajas)/.test(t)
  ) return "budget_add_item";
  if (/\b(cambia|modifica|actualiza|corrige|pon|sube|baja)\b.*(precio|cantidad|unidades|euros?|€|iva)/.test(t)) return "budget_modify_item";
  if (/\b(el\s+cliente\s+es|para\s+el\s+cliente|cliente[:\s]+|cliente\s+se\s+llama)/.test(t)) return "budget_set_client";
  if (/\b(presupuestos?)\b.*(pendientes?|activos?|lista|ver|mostrar|consultar|buscar)/.test(t)) return "budget_query";

  // Clientes
  if (/\b(clientes?|busca|consulta|informacion)\b.*(cliente|nombre|empresa)/.test(t) ||
      /\bcliente\b/.test(t)) return "client_query";

  // Facturas
  if (/\b(facturas?|cobro|cobrar|facturado|pendiente de cobro)/.test(t)) return "invoice_query";

  // Partes de trabajo
  if (/\b(partes?|parte de trabajo|trabajos?|encargo|faena|servicio)/.test(t)) return "parte_query";

  // Agenda
  if (/\b(agenda|cita|visita|programar|cuando|proxima)/.test(t)) return "schedule_query";

  // Catálogo
  if (/\b(catalogo|precio de|cuanto cuesta|cuanto vale|materiales?)/.test(t)) return "catalog_query";

  return "general";
}

// ────────────────────────────────────────────────────────────────────────────
// Extractor de ítems de presupuesto desde texto natural
// ────────────────────────────────────────────────────────────────────────────

interface ParsedItem {
  description: string;
  quantity: number;
  unit_price: number | null;
  unit: string;
}

function extractBudgetItems(text: string): ParsedItem[] {
  const normalized = electricistaDomainAdapter.normalizeInput
    ? (electricistaDomainAdapter.normalizeInput(text) as string)
    : text;

  const items: ParsedItem[] = [];

  // Patrón: "N [unidades de] PRODUCTO [a PRECIO euros]"
  // Ejemplos:
  //   "dos enchufes a veinte euros" → qty=2 desc="bases de enchufe" price=20
  //   "3 metros de cable a 4,50" → qty=3 desc="cable" price=4.50
  //   "cuadro eléctrico" (sin cantidad) → qty=1
  const ITEM_REGEX =
    /(\d+(?:[.,]\d+)?|un[ao]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|veinticinco|treinta|cuarenta|cincuenta)\s+(?:(metros?|m\b|cajas?|rollos?|paquetes?|unidades?|uds?|bobinas?)\s+(?:de\s+)?)?([^,;]+?)(?:\s+a\s+(\d+(?:[.,]\d+)?)\s*(?:euros?|€|eur\b|€\/ud)?)?(?:[,;]|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = ITEM_REGEX.exec(normalized)) !== null) {
    const qty = parseNumber(match[1]) ?? 1;
    const rawUnit = match[2]?.toLowerCase();
    const desc = match[3]?.trim().replace(/\s+/g, " ") ?? "";
    const priceRaw = match[4];

    const unitMap: Record<string, string> = {
      metro: "m", metros: "m", m: "m",
      caja: "caja", cajas: "caja",
      rollo: "rollo", rollos: "rollo",
      paquete: "paquete", paquetes: "paquete",
      bobina: "bobina", bobinas: "bobina",
      unidad: "ud", unidades: "ud", ud: "ud", uds: "ud",
    };
    const unit = rawUnit ? (unitMap[rawUnit] ?? rawUnit) : "ud";

    if (!desc || desc.length < 2) continue;

    const unit_price = priceRaw !== undefined ? parseNumber(priceRaw) : null;

    items.push({
      description: desc.charAt(0).toUpperCase() + desc.slice(1),
      quantity: qty,
      unit,
      unit_price,
    });
  }

  return items;
}

// ────────────────────────────────────────────────────────────────────────────
// Calcular totales de un borrador
// ────────────────────────────────────────────────────────────────────────────

function computeTotals(draft: Voice360Draft): Voice360Totals {
  const incomplete: string[] = [];
  let subtotal = 0;

  for (const item of draft.items) {
    if (item.unit_price === null || item.unit_price === undefined) {
      incomplete.push(item.description);
    } else {
      subtotal += item.quantity * item.unit_price;
    }
  }

  const taxRate = draft.tax_rate ?? 21;
  const tax_amount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + tax_amount) * 100) / 100;
  subtotal = Math.round(subtotal * 100) / 100;

  return { subtotal, tax_amount, total, incomplete };
}

// ────────────────────────────────────────────────────────────────────────────
// Confirmación token store (en memoria — idempotente por token)
// ────────────────────────────────────────────────────────────────────────────

interface PendingConfirmation {
  action: string;
  payload: Record<string, unknown>;
  label: string;
  expires_at: number;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

function createConfirmToken(
  action: string,
  label: string,
  payload: Record<string, unknown>
): string {
  // Limpiar tokens expirados
  const now = Date.now();
  for (const [key, value] of pendingConfirmations.entries()) {
    if (value.expires_at < now) pendingConfirmations.delete(key);
  }

  const token = `v360-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pendingConfirmations.set(token, {
    action,
    label,
    payload,
    expires_at: now + 5 * 60 * 1000, // 5 minutos
  });
  return token;
}

function consumeToken(token: string): PendingConfirmation | null {
  const entry = pendingConfirmations.get(token);
  if (!entry) return null;
  if (entry.expires_at < Date.now()) {
    pendingConfirmations.delete(token);
    return null;
  }
  pendingConfirmations.delete(token); // idempotente: consume una vez
  return entry;
}

// ────────────────────────────────────────────────────────────────────────────
// Handlers de intent
// ────────────────────────────────────────────────────────────────────────────

interface HandlerResult {
  answer: string;
  draft?: Voice360Draft;
  totals?: Voice360Totals;
  pending_action?: Voice360PendingAction;
}

async function handleBudgetCreate(
  text: string,
  currentDraft: Voice360Draft | null
): Promise<HandlerResult> {
  await initializeDatabase();
  const db = getDbClient();

  // Extraer cliente
  const clientMatch =
    text.match(/para\s+([\w\s]{2,40?}?)(?:\s+(?:de|para|,|$))/i) ??
    text.match(/(?:cliente[:\s]+|para\s+)([\w\s]{2,30})/i);

  let clientName = clientMatch?.[1]?.trim() ?? "";

  // Buscar cliente en BD si se menciona un nombre
  let clientCandidates: Array<{ id: string; name: string; match_confidence?: number }> = [];
  if (clientName && clientName.length >= 2) {
    const res = await db.execute({
      sql: "SELECT id, name FROM clients WHERE name LIKE ? LIMIT 5",
      args: [`%${clientName}%`],
    });
    clientCandidates = res.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
    }));
    if (clientCandidates.length === 1) clientName = clientCandidates[0].name;
  }

  // Extraer ítems del texto
  const parsed = extractBudgetItems(text);
  const items: Voice360Item[] = parsed.map((p) => ({
    id: crypto.randomUUID(),
    description: p.description,
    quantity: p.quantity,
    unit: p.unit,
    unit_price: p.unit_price,
  }));

  const draft: Voice360Draft = {
    revision: (currentDraft?.revision ?? 0) + 1,
    client_name: clientName || currentDraft?.client_name || "",
    client_candidates: clientCandidates,
    tax_rate: 21,
    items: items.length > 0 ? items : (currentDraft?.items ?? []),
    notes: [],
  };

  const totals = computeTotals(draft);

  const hasIncomplete = totals.incomplete.length > 0;
  const itemSummary = draft.items
    .map((i) =>
      `• ${i.quantity} ${i.unit} de ${i.description}${i.unit_price !== null ? ` — ${i.unit_price.toFixed(2)} €/ud` : " — precio pendiente"}`
    )
    .join("\n");

  let answer = `✅ Borrador creado${draft.client_name ? ` para **${draft.client_name}**` : ""}:\n\n${itemSummary}\n\n`;

  if (hasIncomplete) {
    answer += `⚠️ Faltan precios para: ${totals.incomplete.join(", ")}. Dímelos para calcular el total.\n`;
  } else {
    answer += `**Total: ${totals.total.toFixed(2)} €** (IVA incluido al 21%)\n\nDi "confirmar" cuando quieras guardar el presupuesto.`;
  }

  return { answer, draft, totals };
}

async function handleAddItem(
  text: string,
  currentDraft: Voice360Draft | null
): Promise<HandlerResult> {
  const parsed = extractBudgetItems(text);
  if (parsed.length === 0) {
    return { answer: "No he podido identificar el artículo o cantidad. Intenta con: \"Añade 3 enchufes a 12 euros\".", draft: currentDraft ?? undefined };
  }

  const newItems: Voice360Item[] = parsed.map((p) => ({
    id: crypto.randomUUID(),
    description: p.description,
    quantity: p.quantity,
    unit: p.unit,
    unit_price: p.unit_price,
  }));

  const draft: Voice360Draft = {
    ...(currentDraft ?? { client_name: "", client_candidates: [], tax_rate: 21, notes: [], items: [] }),
    revision: (currentDraft?.revision ?? 0) + 1,
    items: [...(currentDraft?.items ?? []), ...newItems],
  };

  const totals = computeTotals(draft);
  const addedSummary = newItems.map((i) => `• ${i.quantity} ${i.unit} de ${i.description}`).join("\n");
  return {
    answer: `✅ Añadido al borrador:\n${addedSummary}\n\nTotal actual: **${totals.total.toFixed(2)} €**`,
    draft,
    totals,
  };
}

async function handleModifyItem(
  text: string,
  currentDraft: Voice360Draft | null
): Promise<HandlerResult> {
  if (!currentDraft || currentDraft.items.length === 0) {
    return { answer: "No hay borrador activo para modificar. Empieza diciendo: \"Hazme un presupuesto de...\"" };
  }

  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Cambiar cantidad — "cambia los enchufes a cuatro"
  const qtyMatch = t.match(
    /(?:cambia|pon|modifica)\s+(?:los?\s+)?(.{2,30}?)\s+a\s+(\d+(?:[.,]\d+)?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte)\s*(?:unidades?|uds?)?/i
  );

  // Cambiar precio — "pon el precio del cable a 8 euros"
  const priceMatch = t.match(
    /(?:cambia|pon|modifica)\s+(?:el\s+)?precio\s+(?:del?\s+)?(.{2,30}?)\s+a\s+(\d+(?:[.,]\d+)?)\s*(?:euros?|€)?/i
  );

  let modified = false;
  const items = [...currentDraft.items];

  if (qtyMatch) {
    const keyword = qtyMatch[1].trim();
    const newQty = parseNumber(qtyMatch[2]);
    if (newQty !== null) {
      for (const item of items) {
        if (item.description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(keyword)) {
          item.quantity = newQty;
          modified = true;
          break;
        }
      }
    }
  } else if (priceMatch) {
    const keyword = priceMatch[1].trim();
    const newPrice = parseNumber(priceMatch[2]);
    if (newPrice !== null) {
      for (const item of items) {
        if (item.description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(keyword)) {
          item.unit_price = newPrice;
          modified = true;
          break;
        }
      }
    }
  }

  if (!modified) {
    return {
      answer: "No he encontrado ese artículo en el borrador. Intenta con: \"Cambia los enchufes a cuatro\" o \"Pon el precio del cable a 8 euros\".",
      draft: currentDraft,
    };
  }

  const draft: Voice360Draft = { ...currentDraft, revision: currentDraft.revision + 1, items };
  const totals = computeTotals(draft);

  return {
    answer: `✅ Borrador actualizado. Total: **${totals.total.toFixed(2)} €**\n\nDi "confirmar" para guardar.`,
    draft,
    totals,
  };
}

async function handleBudgetConfirm(
  currentDraft: Voice360Draft | null
): Promise<HandlerResult> {
  if (!currentDraft || currentDraft.items.length === 0) {
    return { answer: "No hay borrador activo para confirmar." };
  }

  const totals = computeTotals(currentDraft);
  if (totals.incomplete.length > 0) {
    return {
      answer: `⚠️ Faltan precios para: ${totals.incomplete.join(", ")}. Por favor indícalos antes de confirmar.`,
      draft: currentDraft,
      totals,
    };
  }

  const itemsSummary = currentDraft.items
    .map((i) => `• ${i.quantity} ${i.unit} de ${i.description} — ${((i.unit_price ?? 0) * i.quantity).toFixed(2)} €`)
    .join("\n");

  const label =
    `Crear presupuesto${currentDraft.client_name ? ` para ${currentDraft.client_name}` : ""}\n` +
    `${itemsSummary}\n` +
    `**Total: ${totals.total.toFixed(2)} €** (IVA ${currentDraft.tax_rate}%)`;

  const token = createConfirmToken("create_budget", label, {
    draft: currentDraft,
    totals,
  });

  const pending_action: Voice360PendingAction = {
    action: "create_budget",
    label,
    token,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };

  return {
    answer: `📋 Revisa el presupuesto antes de guardarlo:\n\n${itemsSummary}\n\n**Total: ${totals.total.toFixed(2)} €**\n\nPulsa "Confirmar" para guardar definitivamente.`,
    draft: currentDraft,
    totals,
    pending_action,
  };
}

async function executeBudgetSave(
  payload: Record<string, unknown>
): Promise<HandlerResult> {
  try {
    await initializeDatabase();
    const db = getDbClient();

    const draft = payload.draft as Voice360Draft;
    const totals = payload.totals as Voice360Totals;

    // Buscar o usar cliente
    let clientId: string | null = null;
    if (draft.client_name) {
      const clientRes = await db.execute({
        sql: "SELECT id FROM clients WHERE name LIKE ? LIMIT 1",
        args: [`%${draft.client_name}%`],
      });
      if (clientRes.rows.length > 0) {
        clientId = clientRes.rows[0].id as string;
      }
    }

    // Número de presupuesto (generador canónico PRES_XXXX)
    const budgetNumber = await generateBudgetNumber();
    const budgetId = crypto.randomUUID();
    const now = new Date().toISOString().split("T")[0];

    await db.execute({
      sql: `INSERT INTO budgets (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: [
        budgetId,
        budgetNumber,
        clientId,
        now,
        totals.subtotal,
        draft.tax_rate,
        totals.tax_amount,
        totals.total,
      ],
    });

    for (const item of draft.items) {
      await db.execute({
        sql: `INSERT INTO budget_items (id, budget_id, description, quantity, unit, unit_price, total, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          crypto.randomUUID(),
          budgetId,
          item.description,
          item.quantity,
          item.unit,
          item.unit_price ?? 0,
          (item.unit_price ?? 0) * item.quantity,
        ],
      });
    }

    return {
      answer: `✅ **Presupuesto ${budgetNumber} guardado** correctamente${draft.client_name ? ` para ${draft.client_name}` : ""}.\n\nTotal: **${totals.total.toFixed(2)} €**\n\nPuedes verlo en la sección de Presupuestos.`,
    };
  } catch (err: any) {
    return {
      answer: `❌ No se pudo guardar el presupuesto: ${err?.message ?? "Error de base de datos"}. Los datos no se han modificado.`,
    };
  }
}

async function handleQuery(intent: Intent, text: string): Promise<HandlerResult> {
  await initializeDatabase();
  const db = getDbClient();

  try {
    switch (intent) {
      case "client_query": {
        const nameMatch = text.match(
          /(?:cliente|busca|informacion\s+de|buscar)\s+([\w\s]{2,40})/i
        );
        const term = nameMatch?.[1]?.trim() ?? "";

        const res = await db.execute(
          term.length >= 2
            ? {
                sql: "SELECT id, name, status, phone, company FROM clients WHERE name LIKE ? OR company LIKE ? ORDER BY updated_at DESC LIMIT 5",
                args: [`%${term}%`, `%${term}%`],
              }
            : "SELECT id, name, status, phone, company FROM clients ORDER BY updated_at DESC LIMIT 8"
        );

        if (res.rows.length === 0)
          return { answer: `No encontré clientes${term ? ` con el nombre "${term}"` : ""}. Prueba con otro nombre o ve a la sección Clientes.` };

        const list = res.rows
          .map((r) => `• **${r.name}** ${r.company ? `(${r.company})` : ""} | ${r.status ?? "activo"} ${r.phone ? `| ☎ ${r.phone}` : ""}`)
          .join("\n");
        return { answer: `👤 Clientes encontrados:\n\n${list}` };
      }

      case "invoice_query": {
        const res = await db.execute(`
          SELECT i.number, i.total, i.status, i.due_date, c.name as client_name
          FROM invoices i
          LEFT JOIN clients c ON c.id = i.client_id
          ORDER BY i.created_at DESC LIMIT 8
        `);
        if (res.rows.length === 0)
          return { answer: "No hay facturas registradas." };

        const list = res.rows
          .map(
            (r) =>
              `• **${r.number}** — ${r.client_name ?? "Sin cliente"} — ${Number(r.total ?? 0).toFixed(2)} € — *${r.status}*${r.due_date ? ` — Vence: ${r.due_date}` : ""}`
          )
          .join("\n");
        return { answer: `🧾 Facturas recientes:\n\n${list}` };
      }

      case "parte_query": {
        const res = await db.execute(`
          SELECT p.numero, p.estado, p.fecha, COALESCE(c.name, p.cliente) as client_name
          FROM partes_trabajo p
          LEFT JOIN clients c ON c.id = p.client_id
          ORDER BY p.fecha DESC, p.created_at DESC LIMIT 8
        `);
        if (res.rows.length === 0)
          return { answer: "No hay partes de trabajo registrados." };

        const list = res.rows
          .map(
            (r) =>
              `• **${r.numero}** — ${r.client_name ?? "Sin cliente"} — *${r.estado}* — ${r.fecha ?? ""}`
          )
          .join("\n");
        return { answer: `🔧 Partes de trabajo recientes:\n\n${list}` };
      }

      case "schedule_query": {
        const today = new Date().toISOString().split("T")[0];
        const res = await db.execute({
          sql: `SELECT v.date, v.time, v.title, v.status, c.name as client_name
                FROM visits v
                LEFT JOIN clients c ON c.id = v.client_id
                WHERE date(v.date) >= ?
                ORDER BY v.date ASC, v.time ASC LIMIT 10`,
          args: [today],
        });
        if (res.rows.length === 0)
          return { answer: "No tienes visitas o citas programadas próximamente." };

        const list = res.rows
          .map(
            (r) =>
              `• **${r.date}${r.time ? ` ${r.time}` : ""}** — ${r.title ?? "Visita"} — ${r.client_name ?? "Sin cliente"}`
          )
          .join("\n");
        return { answer: `📅 Próximas visitas/citas:\n\n${list}` };
      }

      case "budget_query": {
        const res = await db.execute(`
          SELECT b.number, b.total, b.status, b.created_at, c.name as client_name
          FROM budgets b
          LEFT JOIN clients c ON c.id = b.client_id
          ORDER BY b.created_at DESC LIMIT 8
        `);
        if (res.rows.length === 0)
          return { answer: "No hay presupuestos registrados todavía." };

        const list = res.rows
          .map(
            (r) =>
              `• **${r.number}** — ${r.client_name ?? "Sin cliente"} — ${Number(r.total ?? 0).toFixed(2)} € — *${r.status}*`
          )
          .join("\n");
        return { answer: `📋 Presupuestos recientes:\n\n${list}` };
      }

      case "catalog_query": {
        const qMatch = text.match(
          /(?:precio\s+(?:de|del?)\s+|cuanto\s+(?:cuesta|vale)\s+(?:el?\s+|la\s+)?|catalogo\s+de\s+|materiales?\s+de\s+)(.{2,60})/i
        );
        const term = qMatch?.[1]?.trim() ?? text.slice(0, 60);

        const res = await db.execute({
          sql: `SELECT name, unit_price, category FROM catalog_items
                WHERE name LIKE ? OR description LIKE ? OR category LIKE ?
                ORDER BY name LIMIT 8`,
          args: [`%${term}%`, `%${term}%`, `%${term}%`],
        });

        if (res.rows.length === 0)
          return { answer: `No encontré materiales para "${term}". Consulta el catálogo completo en la sección Catálogo.` };

        const list = res.rows
          .map((r) => `• **${r.name}** — ${Number(r.unit_price ?? 0).toFixed(2)} €/ud — *${r.category}*`)
          .join("\n");
        return { answer: `📦 Materiales encontrados:\n\n${list}` };
      }

      default:
        return {
          answer:
            "Puedo ayudarte con presupuestos, clientes, facturas, partes de trabajo y agenda.\n\nEjemplos:\n• \"Hazme un presupuesto de 4 enchufes a 18 euros para Carlos\"\n• \"¿Qué facturas tengo pendientes?\"\n• \"Busca el cliente Fernández\"\n• \"¿Qué trabajos tengo esta semana?\"",
        };
    }
  } catch (err: any) {
    return {
      answer: `⚠️ Error consultando datos: ${err?.message ?? "Error de base de datos"}`,
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Handler principal POST
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // ── Flujo de confirmación de acción pendiente ──
    if (body.confirm_token && typeof body.confirm_token === "string") {
      const pending = consumeToken(body.confirm_token);
      if (!pending) {
        return NextResponse.json(
          { error: "Token de confirmación inválido o expirado. Repite la acción." },
          { status: 400 }
        );
      }

      if (pending.action === "create_budget") {
        const result = await executeBudgetSave(pending.payload);
        return NextResponse.json({ answer: result.answer, result: null });
      }

      return NextResponse.json(
        { error: `Acción desconocida: ${pending.action}` },
        { status: 400 }
      );
    }

    // ── Flujo normal: procesar input de voz ──
    const rawInput: string =
      typeof body.input === "string" ? body.input.trim() : "";

    if (!rawInput) {
      return NextResponse.json(
        { error: "El campo 'input' es obligatorio." },
        { status: 400 }
      );
    }

    if (rawInput.length > 1000) {
      return NextResponse.json(
        { error: "Mensaje demasiado largo (máximo 1000 caracteres)." },
        { status: 400 }
      );
    }

    // Borrador actual enviado desde la UI
    const currentDraft: Voice360Draft | null = body.draft ?? null;

    // Normalizar input con vocabulario eléctrico
    const normalizedInput = electricistaDomainAdapter.normalizeInput
      ? (electricistaDomainAdapter.normalizeInput(rawInput) as string)
      : rawInput;

    const intent = detectIntent(normalizedInput);

    let result: HandlerResult;

    switch (intent) {
      case "budget_create":
        result = await handleBudgetCreate(normalizedInput, currentDraft);
        break;
      case "budget_add_item":
        result = await handleAddItem(normalizedInput, currentDraft);
        break;
      case "budget_modify_item":
        result = await handleModifyItem(normalizedInput, currentDraft);
        break;
      case "budget_confirm":
        result = await handleBudgetConfirm(currentDraft);
        break;
      case "budget_cancel":
        result = { answer: "Borrador cancelado. Puedes empezar uno nuevo cuando quieras." };
        break;
      default:
        result = await handleQuery(intent, normalizedInput);
        break;
    }

    return NextResponse.json({
      success: true,
      intent: intent === "budget_create" ? "electricista:budget_draft" : ("electricista:" + intent),
      answer: result.answer,
      draft: result.draft ?? null,
      totals: result.totals ?? null,
      pending_action: result.pending_action ?? null,
    });
  } catch (err: any) {
    console.error("[voice360/route] error:", err);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        answer: "Error interno procesando la solicitud. Por favor inténtalo de nuevo.",
      },
      { status: 500 }
    );
  }
}
