import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");

    let result;
    if (search) {
      result = await db.execute({
        sql: `SELECT clients.*, COALESCE(inv_count.count, 0) as invoice_count 
              FROM clients 
              LEFT JOIN (SELECT client_id, COUNT(*) as count FROM invoices GROUP BY client_id) inv_count 
              ON clients.id = inv_count.client_id
              WHERE clients.name LIKE ? OR clients.nif LIKE ? OR clients.email LIKE ? OR clients.phone LIKE ? 
              ORDER BY clients.name`,
        args: [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`],
      });
    } else {
      result = await db.execute(
        `SELECT clients.*, COALESCE(inv_count.count, 0) as invoice_count 
         FROM clients 
         LEFT JOIN (SELECT client_id, COUNT(*) as count FROM invoices GROUP BY client_id) inv_count 
         ON clients.id = inv_count.client_id
         ORDER BY clients.name`
      );
    }

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
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();
    const id = uuidv4();

    await db.execute({
      sql: `INSERT INTO clients (id, name, nif, email, phone, address, city, postal_code, province, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.name,
        body.nif || null,
        body.email || null,
        body.phone || null,
        body.address || null,
        body.city || null,
        body.postal_code || null,
        body.province || null,
        body.notes || null,
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
