import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  if (process.env.DEMO_MODE === "true") {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    return NextResponse.json([
      { id: "demo-visit-001", client_id: "demo-c1", client_name: "Comunidad Prop. Autonomía 14", title: "Revisión cuadro eléctrico", description: "Inspección anual del cuadro general", date: today, time: "09:30", duration: 90, status: "scheduled", address: "C/ Autonomía 14, Eibar" },
      { id: "demo-visit-002", client_id: "demo-c5", client_name: "María López García", title: "Instalación punto de recarga", description: "Punto de recarga vehículo eléctrico en garaje", date: today, time: "16:00", duration: 120, status: "scheduled", address: "C/ Errebal 22, Eibar" },
      { id: "demo-visit-003", client_id: "demo-c3", client_name: "Talleres Mecánicos Eibar S.L.", title: "Ampliación línea trifásica", description: "Nueva línea para compresor industrial", date: tomorrowStr, time: "08:00", duration: 180, status: "scheduled", address: "Polígono Azitain, Nave 12, Eibar" },
      { id: "demo-visit-004", client_id: "demo-c2", client_name: "Bar Restaurante Zubialde", title: "Revisión emergencia luminaria", description: "Sustitución de equipos de emergencia caducados", date: tomorrowStr, time: "14:30", duration: 60, status: "scheduled", address: "Plaza del Mercado 7, Eibar" },
    ]);
  }

  try {
    await initializeDatabase();
    const db = getDbClient();
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("client_id");
    const status = searchParams.get("status");

    let query = `
      SELECT visits.*, clients.name as client_name 
      FROM visits 
      LEFT JOIN clients ON visits.client_id = clients.id
    `;
    const conditions: string[] = [];
    const args: string[] = [];

    if (clientId) {
      conditions.push("visits.client_id = ?");
      args.push(clientId);
    }
    if (status) {
      conditions.push("visits.status = ?");
      args.push(status);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY visits.date ASC, visits.time ASC";

    const result = await db.execute({ sql: query, args });
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener visitas" },
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
      sql: `INSERT INTO visits (id, client_id, title, description, date, time, duration, status, address, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.client_id || null,
        body.title,
        body.description || null,
        body.date,
        body.time || null,
        body.duration || 60,
        body.status || "scheduled",
        body.address || null,
        body.notes || null,
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM visits WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear visita" },
      { status: 500 }
    );
  }
}
