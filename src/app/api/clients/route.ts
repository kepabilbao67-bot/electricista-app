import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");

    let clients;
    if (search) {
      clients = db
        .prepare(
          "SELECT * FROM clients WHERE name LIKE ? OR nif LIKE ? OR email LIKE ? OR phone LIKE ? ORDER BY name"
        )
        .all(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    } else {
      clients = db.prepare("SELECT * FROM clients ORDER BY name").all();
    }

    return NextResponse.json(clients);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener clientes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const id = uuidv4();

    db.prepare(
      `INSERT INTO clients (id, name, nif, email, phone, address, city, postal_code, province, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      body.name,
      body.nif || null,
      body.email || null,
      body.phone || null,
      body.address || null,
      body.city || null,
      body.postal_code || null,
      body.province || null,
      body.notes || null
    );

    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
    return NextResponse.json(client, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear cliente" },
      { status: 500 }
    );
  }
}
