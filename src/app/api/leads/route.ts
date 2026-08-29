import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { checkRateLimit, validateHoneypot, getClientIp } from "@/lib/security";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();

    const result = await db.execute(
      "SELECT * FROM leads ORDER BY created_at DESC"
    );

    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener leads" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // 1. Capa Anti-Spam: Rate Limiting
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(clientIp);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Demasiadas solicitudes. Límite de tasa excedido temporalmente.",
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.retryAfter || 60),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    await initializeDatabase();
    const db = getDbClient();
    let body: any;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    // 2. Capa Anti-Spam: Honeypot y Timestamp check
    const honeypotResult = validateHoneypot(body?._hp, body?._ts);
    if (honeypotResult.isSpam) {
      return NextResponse.json(
        { error: "Solicitud rechazada por filtros de seguridad automatizados." },
        { status: 400 }
      );
    }

    if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO leads (id, name, email, phone, source, interest, message, status, created_at, updated_at, name_color, source_color, interest_color, message_color)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'nuevo', ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.name.trim(),
        body.email || null,
        body.phone || null,
        body.source || null,
        body.interest || null,
        body.message || null,
        now,
        now,
        body.name_color || null,
        body.source_color || null,
        body.interest_color || null,
        body.message_color || null,
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM leads WHERE id = ?",
      args: [id],
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear lead" },
      { status: 500 }
    );
  }
}
