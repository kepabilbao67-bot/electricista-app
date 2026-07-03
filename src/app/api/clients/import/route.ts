import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();
    const clients = body.clients as Array<{
      name: string;
      nif?: string;
      phone?: string;
      email?: string;
      address?: string;
      city?: string;
      postal_code?: string;
      province?: string;
      notes?: string;
    }>;

    if (!clients || clients.length === 0) {
      return NextResponse.json({ error: "No se han proporcionado clientes" }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const client of clients) {
      if (!client.name || !client.name.trim()) {
        skipped++;
        continue;
      }

      // Check if client already exists (by name or NIF)
      let exists = false;
      if (client.nif && client.nif.trim()) {
        const existing = await db.execute({
          sql: "SELECT id FROM clients WHERE nif = ?",
          args: [client.nif.trim()],
        });
        if (existing.rows.length > 0) {
          exists = true;
          skipped++;
          errors.push(`${client.name} (NIF ${client.nif}) ya existe`);
        }
      }

      if (!exists) {
        const existingByName = await db.execute({
          sql: "SELECT id FROM clients WHERE LOWER(name) = LOWER(?)",
          args: [client.name.trim()],
        });
        if (existingByName.rows.length > 0) {
          exists = true;
          skipped++;
          errors.push(`${client.name} ya existe`);
        }
      }

      if (!exists) {
        const id = uuidv4();
        await db.execute({
          sql: `INSERT INTO clients (id, name, nif, email, phone, address, city, postal_code, province, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            client.name.trim(),
            client.nif?.trim() || null,
            client.email?.trim() || null,
            client.phone?.trim() || null,
            client.address?.trim() || null,
            client.city?.trim() || null,
            client.postal_code?.trim() || null,
            client.province?.trim() || null,
            client.notes?.trim() || null,
          ],
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: clients.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Error al importar clientes" },
      { status: 500 }
    );
  }
}
