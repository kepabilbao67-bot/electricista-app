/**
 * AUTÓNOMO360 - Asistente Comercial Barymont / CRM
 *
 * Resuelve consultas comerciales consultando datos REALES de la base de datos:
 * - Llamadas y tareas pendientes de hoy
 * - Clientes sin seguimiento reciente
 * - Oportunidades calientes y pipeline
 * - Reuniones y citas programadas
 * - Clientes con documentación pendiente
 * - Resumen ejecutivo de ficha de cliente
 */

import { getDbClient, initializeDatabase } from "@/lib/db";

export async function answerCommercialQuery(query: string): Promise<string | null> {
  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  await initializeDatabase();
  const db = getDbClient();

  // 1. ¿A quién tengo que llamar hoy? / Tareas de hoy
  if (
    q.includes("llamar hoy") ||
    q.includes("a quien tengo que llamar") ||
    q.includes("llamadas de hoy") ||
    q.includes("llamadas pendientes") ||
    q.includes("tareas hoy") ||
    q.includes("tareas de hoy")
  ) {
    const today = new Date().toISOString().split("T")[0];

    const tasks = await db.execute({
      sql: `SELECT t.*, c.name as client_name, c.phone as client_phone, c.company as client_company
            FROM crm_tasks t
            LEFT JOIN clients c ON c.id = t.client_id
            WHERE t.status = 'pending' AND (t.due_at IS NULL OR date(t.due_at) <= ?)
            ORDER BY CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END, t.due_at ASC
            LIMIT 10`,
      args: [today],
    });

    const oppFollowups = await db.execute({
      sql: `SELECT o.*, c.name as client_name, c.phone as client_phone, c.company as client_company
            FROM opportunities o
            LEFT JOIN clients c ON c.id = o.client_id
            WHERE o.next_action_at IS NOT NULL
              AND date(o.next_action_at) <= ?
              AND o.stage NOT IN ('cliente', 'perdido', 'no_interesado', 'cobrado')
            ORDER BY o.next_action_at ASC
            LIMIT 10`,
      args: [today],
    });

    if (tasks.rows.length === 0 && oppFollowups.rows.length === 0) {
      return (
        "📞 **Llamadas y tareas de hoy:**\n\n" +
        "No tienes llamadas ni tareas marcadas como pendientes para hoy. ¡Todo al día!"
      );
    }

    let response = "📞 **Llamadas y seguimientos previstos para hoy:**\n\n";

    if (oppFollowups.rows.length > 0) {
      response += "**Próximas acciones comerciales:**\n";
      oppFollowups.rows.forEach((o, i) => {
        const client = (o.client_name as string) || "Cliente sin asignar";
        const phone = (o.client_phone as string) ? `(Tel: ${o.client_phone})` : "";
        const action = (o.next_action as string) || "Seguimiento comercial";
        response += `${i + 1}. **${client}** ${phone} — ${action} [Oportunidad: *${o.title}*]\n`;
      });
      response += "\n";
    }

    if (tasks.rows.length > 0) {
      response += "**Tareas y recordatorios pendientes:**\n";
      tasks.rows.forEach((t, i) => {
        const client = t.client_name ? ` (${t.client_name})` : "";
        response += `- [ ] **${t.title}**${client}${t.due_at ? ` — Fecha: ${t.due_at}` : ""}\n`;
      });
    }

    return response;
  }

  // 2. ¿Qué clientes llevan más tiempo sin seguimiento?
  if (
    q.includes("sin seguimiento") ||
    q.includes("tiempo sin contacto") ||
    q.includes("mas tiempo sin") ||
    q.includes("seguimiento vencido")
  ) {
    const inactiveClients = await db.execute(`
      SELECT c.id, c.name, c.company, c.phone, c.email, c.status,
             MAX(a.occurred_at) as last_activity,
             c.created_at
      FROM clients c
      LEFT JOIN crm_activities a ON a.client_id = c.id
      WHERE c.status NOT IN ('perdido', 'no_interesado')
      GROUP BY c.id
      ORDER BY CASE WHEN MAX(a.occurred_at) IS NULL THEN 0 ELSE 1 END,
               last_activity ASC, c.created_at ASC
      LIMIT 8
    `);

    if (inactiveClients.rows.length === 0) {
      return "📊 No hay clientes registrados actualmente para evaluar el tiempo de seguimiento.";
    }

    let response = "⚠️ **Clientes que requieren seguimiento prioritario:**\n\n";
    inactiveClients.rows.forEach((c, i) => {
      const name = c.name as string;
      const phone = c.phone ? ` | Tel: ${c.phone}` : "";
      const status = c.status ? ` [Estado: ${c.status}]` : "";
      const last = c.last_activity
        ? `Último contacto: ${new Date(c.last_activity as string).toLocaleDateString("es-ES")}`
        : "Sin actividad registrada aún";
      response += `${i + 1}. **${name}**${phone}${status}\n   *${last}*\n`;
    });

    response += "\n💡 *Recomendación:* Entra en su ficha para registrar una llamada o agendar reunión.";
    return response;
  }

  // 3. ¿Qué oportunidades están más calientes?
  if (
    q.includes("oportunidades mas calientes") ||
    q.includes("oportunidades calientes") ||
    q.includes("mas calientes") ||
    q.includes("mayor probabilidad") ||
    q.includes("pipeline caliente")
  ) {
    const hotOpps = await db.execute(`
      SELECT o.*, c.name as client_name, c.phone as client_phone, c.company as client_company
      FROM opportunities o
      LEFT JOIN clients c ON c.id = o.client_id
      WHERE o.stage NOT IN ('cliente', 'perdido', 'no_interesado', 'cobrado')
      ORDER BY o.probability DESC, o.estimated_value DESC
      LIMIT 8
    `);

    if (hotOpps.rows.length === 0) {
      return "🔥 No hay oportunidades activas registradas en el pipeline actualmente.";
    }

    let response = "🔥 **Oportunidades más calientes en el pipeline:**\n\n";
    hotOpps.rows.forEach((o, i) => {
      const client = (o.client_name as string) || "Cliente sin asignar";
      const value = Number(o.estimated_value || 0).toLocaleString("es-ES", {
        minimumFractionDigits: 2,
      });
      const prob = o.probability !== null ? `${o.probability}%` : "50%";
      const next = o.next_action ? ` | Próximo paso: ${o.next_action}` : "";
      response += `${i + 1}. **${o.title}** (${client})\n`;
      response += `   💰 Valor: **${value} €** | Probabilidad: **${prob}** | Etapa: *${o.stage}*${next}\n`;
    });

    return response;
  }

  // 4. ¿Qué reuniones tengo esta semana?
  if (
    q.includes("reuniones") ||
    q.includes("citas") ||
    q.includes("agenda esta semana") ||
    q.includes("reunion esta semana")
  ) {
    const today = new Date().toISOString().split("T")[0];
    const meetings = await db.execute({
      sql: `SELECT v.*, c.name as client_name, c.phone as client_phone, c.company as client_company
            FROM visits v
            LEFT JOIN clients c ON c.id = v.client_id
            WHERE v.status = 'scheduled'
              AND date(v.date) >= ?
              AND date(v.date) <= date(?, '+7 days')
            ORDER BY v.date ASC, v.time ASC
            LIMIT 10`,
      args: [today, today],
    });

    if (meetings.rows.length === 0) {
      return (
        "📅 **Reuniones para los próximos 7 días:**\n\n" +
        "No tienes reuniones agendadas para esta semana en la base de datos."
      );
    }

    let response = "📅 **Reuniones agendadas para los próximos 7 días:**\n\n";
    meetings.rows.forEach((m, i) => {
      const client = (m.client_name as string) || "Sin cliente";
      const phone = (m.client_phone as string) ? ` (Tel: ${m.client_phone})` : "";
      const time = (m.time as string) ? ` a las ${m.time}` : "";
      const title = (m.title as string) || "Reunión de asesoramiento";
      response += `${i + 1}. **${m.date}${time}** — **${title}** con **${client}**${phone}\n`;
      if (m.address) response += `   📍 Lugar: ${m.address}\n`;
    });

    return response;
  }

  // 5. ¿Qué clientes tienen documentación pendiente?
  if (
    q.includes("documentacion pendiente") ||
    q.includes("doc pendiente") ||
    q.includes("documentos pendientes") ||
    q.includes("falta documentacion")
  ) {
    const docClients = await db.execute(`
      SELECT c.id, c.name, c.company, c.phone, c.email, c.notes
      FROM clients c
      WHERE c.status = 'doc_pendiente'
      ORDER BY c.updated_at DESC
      LIMIT 10
    `);

    const docOpps = await db.execute(`
      SELECT o.*, c.name as client_name, c.phone as client_phone
      FROM opportunities o
      LEFT JOIN clients c ON c.id = o.client_id
      WHERE o.stage = 'doc_pendiente'
      ORDER BY o.updated_at DESC
      LIMIT 10
    `);

    if (docClients.rows.length === 0 && docOpps.rows.length === 0) {
      return (
        "📄 **Documentación pendiente:**\n\n" +
        "No hay clientes ni oportunidades marcadas con documentación pendiente actualmente."
      );
    }

    let response = "📄 **Clientes y oportunidades con documentación pendiente:**\n\n";

    if (docClients.rows.length > 0) {
      response += "**Clientes pendientes de aportar datos/documentos:**\n";
      docClients.rows.forEach((c, i) => {
        const phone = c.phone ? ` | Tel: ${c.phone}` : "";
        const note = c.notes ? ` (Nota: ${c.notes})` : "";
        response += `${i + 1}. **${c.name}**${phone}${note}\n`;
      });
      response += "\n";
    }

    if (docOpps.rows.length > 0) {
      response += "**Operaciones pendientes de póliza o estudio:**\n";
      docOpps.rows.forEach((o, i) => {
        const client = o.client_name ? ` para ${o.client_name}` : "";
        const val = Number(o.estimated_value || 0).toLocaleString("es-ES");
        response += `- **${o.title}**${client} (Valor: ${val} €)\n`;
      });
    }

    return response;
  }

  // 6. Resumen de cliente (ej: "resumen de cliente Juan" o "informacion de Maria")
  if (
    q.includes("resumen de este cliente") ||
    q.includes("resumen del cliente") ||
    q.includes("resumen cliente") ||
    q.includes("ficha de") ||
    q.includes("ficha del cliente")
  ) {
    // Intentar extraer el nombre del cliente
    const nameMatch = q.replace(/.*(resumen.*cliente|ficha.*cliente|informacion.*cliente|ficha de|resumen de)\s+/i, "").trim();

    let clientRows: Record<string, unknown>[] = [];
    if (nameMatch.length >= 2) {
      const searchRes = await db.execute({
        sql: "SELECT * FROM clients WHERE name LIKE ? OR email LIKE ? LIMIT 1",
        args: [`%${nameMatch}%`, `%${nameMatch}%`],
      });
      clientRows = searchRes.rows as unknown as Record<string, unknown>[];
    }

    if (clientRows.length === 0) {
      const lastClient = await db.execute("SELECT * FROM clients ORDER BY updated_at DESC, created_at DESC LIMIT 1");
      clientRows = lastClient.rows as unknown as Record<string, unknown>[];
    }

    if (clientRows.length === 0) {
      return "👤 No hay clientes dados de alta en el sistema para generar un resumen.";
    }

    const c = clientRows[0];
    const clientId = c.id as string;

    const opps = await db.execute({
      sql: "SELECT * FROM opportunities WHERE client_id = ? ORDER BY updated_at DESC",
      args: [clientId],
    });

    const acts = await db.execute({
      sql: "SELECT * FROM crm_activities WHERE client_id = ? ORDER BY occurred_at DESC LIMIT 5",
      args: [clientId],
    });

    const tasks = await db.execute({
      sql: "SELECT * FROM crm_tasks WHERE client_id = ? AND status = 'pending' ORDER BY due_at ASC",
      args: [clientId],
    });

    let res = `👤 **Ficha Ejecutiva: ${c.name}**\n\n`;
    res += `• **Empresa:** ${c.company || "Particular"}\n`;
    res += `• **Teléfono:** ${c.phone || "No indicado"}\n`;
    res += `• **Email:** ${c.email || "No indicado"}\n`;
    res += `• **Estado comercial:** ${c.status || "Nuevo"}\n`;
    res += `• **Origen:** ${c.source || "Contacto directo"}\n`;
    if (c.notes) res += `• **Notas:** ${c.notes}\n`;
    res += "\n";

    if (opps.rows.length > 0) {
      res += `**Oportunidades activas (${opps.rows.length}):**\n`;
      opps.rows.forEach((o) => {
        const val = Number(o.estimated_value || 0).toLocaleString("es-ES");
        res += `- **${o.title}** | Estado: *${o.stage}* | Valor: **${val} €** (Prob: ${o.probability || 0}%)\n`;
      });
      res += "\n";
    }

    if (tasks.rows.length > 0) {
      res += `**Tareas pendientes (${tasks.rows.length}):**\n`;
      tasks.rows.forEach((t) => {
        res += `- [ ] ${t.title}${t.due_at ? ` (Vence: ${t.due_at})` : ""}\n`;
      });
      res += "\n";
    }

    if (acts.rows.length > 0) {
      res += `**Última actividad:**\n`;
      acts.rows.forEach((a) => {
        const date = new Date(a.occurred_at as string).toLocaleDateString("es-ES");
        res += `- [${date}] **${a.title}**: ${a.description || a.type}\n`;
      });
    }

    return res;
  }

  return null;
}
