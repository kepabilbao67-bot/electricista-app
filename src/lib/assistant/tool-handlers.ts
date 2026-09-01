import { getDbClient, initializeDatabase } from "@/lib/db";
import { z } from "zod";

export interface ToolExecutionResult {
  tool_name: string;
  success: boolean;
  result?: unknown;
  draft?: {
    type: "budget" | "visit" | "client";
    payload: Record<string, unknown>;
  };
  error?: string;
}

const QueryClientsSchema = z.object({
  query: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

const QueryBudgetsSchema = z.object({
  client_name: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

const QueryInvoicesSchema = z.object({
  client_name: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  overdue_only: z.boolean().optional(),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

const QueryPartesSchema = z.object({
  client_name: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

const QueryScheduleSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days_ahead: z.number().int().min(1).max(14).optional().default(7),
  client_name: z.string().max(100).optional(),
});

const DraftBudgetSchema = z.object({
  client_name: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        description: z.string().max(200),
        quantity: z.number().positive(),
        unit_price: z.number().nonnegative(),
      })
    )
    .optional(),
});

const DraftVisitSchema = z.object({
  client_name: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().max(10).optional(),
});

const DraftClientSchema = z.object({
  name: z.string().min(1).max(100),
  company: z.string().max(100).optional(),
});

export async function executeAssistantTool(
  name: string,
  rawArgs: Record<string, any>
): Promise<ToolExecutionResult> {
  try {
    await initializeDatabase();
    const db = getDbClient();

    switch (name) {
      case "query_clients": {
        const parsed = QueryClientsSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return { tool_name: name, success: false, error: "Argumentos no válidos para query_clients" };
        }
        const { query, status, limit } = parsed.data;

        let sql = "SELECT id, name, status, updated_at FROM clients WHERE 1=1";
        const sqlArgs: any[] = [];

        if (query && query.trim()) {
          sql += " AND (name LIKE ? OR company LIKE ?)";
          const term = `%${query.trim()}%`;
          sqlArgs.push(term, term);
        }

        if (status && status.trim()) {
          sql += " AND status = ?";
          sqlArgs.push(status.trim());
        }

        sql += " ORDER BY updated_at DESC LIMIT ?";
        sqlArgs.push(limit);

        const res = await db.execute({ sql, args: sqlArgs });
        return { tool_name: name, success: true, result: res.rows };
      }

      case "query_budgets": {
        const parsed = QueryBudgetsSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return { tool_name: name, success: false, error: "Argumentos no válidos para query_budgets" };
        }
        const { client_name, status, limit } = parsed.data;

        let sql = `
          SELECT b.id, b.budget_number, b.total_amount, b.status, b.created_at, c.name as client_name
          FROM budgets b
          LEFT JOIN clients c ON c.id = b.client_id
          WHERE 1=1
        `;
        const sqlArgs: any[] = [];

        if (client_name && client_name.trim()) {
          sql += " AND c.name LIKE ?";
          sqlArgs.push(`%${client_name.trim()}%`);
        }

        if (status && status.trim()) {
          sql += " AND b.status = ?";
          sqlArgs.push(status.trim());
        }

        sql += " ORDER BY b.created_at DESC LIMIT ?";
        sqlArgs.push(limit);

        const res = await db.execute({ sql, args: sqlArgs });
        return { tool_name: name, success: true, result: res.rows };
      }

      case "query_invoices": {
        const parsed = QueryInvoicesSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return { tool_name: name, success: false, error: "Argumentos no válidos para query_invoices" };
        }
        const { client_name, status, overdue_only, limit } = parsed.data;

        let sql = `
          SELECT i.id, i.invoice_number, i.total_amount, i.status, i.due_date, i.created_at, c.name as client_name
          FROM invoices i
          LEFT JOIN clients c ON c.id = i.client_id
          WHERE 1=1
        `;
        const sqlArgs: any[] = [];

        if (client_name && client_name.trim()) {
          sql += " AND c.name LIKE ?";
          sqlArgs.push(`%${client_name.trim()}%`);
        }

        if (overdue_only) {
          sql += " AND i.status IN ('pendiente', 'borrador', 'enviada')";
        } else if (status && status.trim()) {
          sql += " AND i.status = ?";
          sqlArgs.push(status.trim());
        }

        sql += " ORDER BY i.created_at DESC LIMIT ?";
        sqlArgs.push(limit);

        const res = await db.execute({ sql, args: sqlArgs });
        return { tool_name: name, success: true, result: res.rows };
      }

      case "query_partes": {
        const parsed = QueryPartesSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return { tool_name: name, success: false, error: "Argumentos no válidos para query_partes" };
        }
        const { client_name, status, limit } = parsed.data;

        let sql = `
          SELECT p.id, p.parte_number, p.status, p.created_at, c.name as client_name
          FROM partes_trabajo p
          LEFT JOIN clients c ON c.id = p.client_id
          WHERE 1=1
        `;
        const sqlArgs: any[] = [];

        if (client_name && client_name.trim()) {
          sql += " AND c.name LIKE ?";
          sqlArgs.push(`%${client_name.trim()}%`);
        }

        if (status && status.trim()) {
          sql += " AND p.status = ?";
          sqlArgs.push(status.trim());
        }

        sql += " ORDER BY p.created_at DESC LIMIT ?";
        sqlArgs.push(limit);

        const res = await db.execute({ sql, args: sqlArgs });
        return { tool_name: name, success: true, result: res.rows };
      }

      case "query_schedule": {
        const parsed = QueryScheduleSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return { tool_name: name, success: false, error: "Argumentos no válidos para query_schedule" };
        }
        const startDate = parsed.data.start_date || new Date().toISOString().split("T")[0];
        const daysAhead = parsed.data.days_ahead;
        const clientName = parsed.data.client_name;

        let sql = `
          SELECT v.id, v.date, v.time, v.status, c.name as client_name
          FROM visits v
          LEFT JOIN clients c ON c.id = v.client_id
          WHERE date(v.date) >= date(?) AND date(v.date) <= date(?, '+' || ? || ' days')
        `;
        const sqlArgs: any[] = [startDate, startDate, daysAhead];

        if (clientName && clientName.trim()) {
          sql += " AND c.name LIKE ?";
          sqlArgs.push(`%${clientName.trim()}%`);
        }

        sql += " ORDER BY v.date ASC, v.time ASC LIMIT 10";

        const res = await db.execute({ sql, args: sqlArgs });
        return { tool_name: name, success: true, result: res.rows };
      }

      case "draft_budget": {
        const parsed = DraftBudgetSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return { tool_name: name, success: false, error: "Argumentos no válidos para draft_budget" };
        }
        return {
          tool_name: name,
          success: true,
          draft: {
            type: "budget",
            payload: {
              client_name: parsed.data.client_name,
              title: parsed.data.title,
              notes: parsed.data.notes || "",
              items: parsed.data.items || [],
            },
          },
        };
      }

      case "draft_visit": {
        const parsed = DraftVisitSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return { tool_name: name, success: false, error: "Argumentos no válidos para draft_visit" };
        }
        return {
          tool_name: name,
          success: true,
          draft: {
            type: "visit",
            payload: {
              client_name: parsed.data.client_name,
              title: parsed.data.title,
              date: parsed.data.date || new Date().toISOString().split("T")[0],
              time: parsed.data.time || "09:00",
            },
          },
        };
      }

      case "draft_client": {
        const parsed = DraftClientSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return { tool_name: name, success: false, error: "Argumentos no válidos para draft_client" };
        }
        return {
          tool_name: name,
          success: true,
          draft: {
            type: "client",
            payload: {
              name: parsed.data.name,
              company: parsed.data.company || "",
            },
          },
        };
      }

      default:
        return { tool_name: name, success: false, error: `Herramienta desconocida: ${name}` };
    }
  } catch (err: any) {
    return {
      tool_name: name,
      success: false,
      error: err?.message || "Error ejecutando consulta en base de datos",
    };
  }
}
