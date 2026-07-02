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
        sql: "SELECT * FROM clients WHERE name LIKE ? OR nif LIKE ? OR email LIKE ? OR phone LIKE ? ORDER BY name",
        args: [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`],
      });
    } else {
      result = await db.execute("SELECT * FROM clients ORDER BY name");
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
