import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { clientSchema } from "@/lib/validations/client-schema";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    let sql = `SELECT clients.*,
              COALESCE(inv_count.count, 0) as invoice_count,
              COALESCE(opp_count.count, 0) as opportunity_count,
              COALESCE(task_count.count, 0) as pending_task_count
              FROM clients
              LEFT JOIN (SELECT client_id, COUNT(*) as count FROM invoices GROUP BY client_id) inv_count
              ON clients.id = inv_count.client_id
              LEFT JOIN (SELECT client_id, COUNT(*) as count FROM opportunities WHERE stage NOT IN ('cliente', 'perdido', 'no_interesado', 'cobrado') GROUP BY client_id) opp_count
              ON clients.id = opp_count.client_id
              LEFT JOIN (SELECT client_id, COUNT(*) as count FROM crm_tasks WHERE status = 'pending' GROUP BY client_id) task_count
              ON clients.id = task_count.client_id`;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (search) {
      conditions.push(
        `(clients.name LIKE ? OR clients.first_name LIKE ? OR clients.last_name LIKE ? OR clients.company LIKE ? OR clients.nif LIKE ? OR clients.email LIKE ? OR clients.phone LIKE ? OR clients.status LIKE ?)`
      );
      const term = `%${search}%`;
      args.push(term, term, term, term, term, term, term, term);
    }

    if (status) {
      conditions.push(`clients.status = ?`);
      args.push(status);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(" AND ");
    }

    sql += ` ORDER BY clients.created_at DESC, clients.name ASC`;

    const result = await db.execute({ sql, args });
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener clientes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validationResult = clientSchema.safeParse(rawBody);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      return NextResponse.json(
        {
          error: "Datos de cliente inválidos",
          details: errorMessages,
          issues: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    await initializeDatabase();
    const db = getDbClient();
    const id = uuidv4();

    // Si tiene first_name o last_name y name se deriva
    let fullName = data.name;
    if ((!fullName || fullName.trim().length === 0) && (data.first_name || data.last_name)) {
      fullName = [data.first_name, data.last_name].filter(Boolean).join(" ");
    }

    await db.execute({
      sql: `INSERT INTO clients (
        id, name, first_name, last_name, company, source, status, probability,
        nif, email, phone, address, city, postal_code, province, notes, client_type,
        address_color, notes_color, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: [
        id,
        fullName,
        data.first_name || null,
        data.last_name || null,
        data.company || null,
        data.source || null,
        data.status || "nuevo",
        data.probability || 0,
        data.nif || null,
        data.email || null,
        data.phone || null,
        data.address || null,
        data.city || null,
        data.postal_code || null,
        data.province || null,
        data.notes || null,
        data.client_type || "particular",
        data.address_color || null,
        data.notes_color || null,
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM clients WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear cliente" },
      { status: 500 }
    );
  }
}
