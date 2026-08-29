import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { checkRateLimit, validateHoneypot, getClientIp } from "@/lib/security";
import { v4 as uuidv4 } from "uuid";

const VALID_TYPES = ["sugerencia", "error", "duda"] as const;

function sanitizeInput(text: unknown): string {
  if (typeof text !== "string") return "";
  return text.trim().replace(/[<>]/g, "");
}

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();

    const result = await db.execute(
      "SELECT * FROM feedback_submissions ORDER BY created_at DESC"
    );

    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener sugerencias y feedback" },
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
        { error: "Solicitud rechazada por filtros de seguridad anti-spam." },
        { status: 400 }
      );
    }

    // 3. Validación y Sanitización de campos
    const rawType = body?.type?.toString().trim().toLowerCase();
    const type = VALID_TYPES.includes(rawType as any) ? rawType : null;
    const subject = sanitizeInput(body?.subject);
    const message = sanitizeInput(body?.message);
    const email = body?.email ? sanitizeInput(body?.email) : null;

    if (!type) {
      return NextResponse.json(
        { error: "Tipo de feedback inválido. Debe ser 'sugerencia', 'error' o 'duda'." },
        { status: 400 }
      );
    }

    if (!subject || subject.length < 3) {
      return NextResponse.json(
        { error: "El asunto es obligatorio y debe tener al menos 3 caracteres." },
        { status: 400 }
      );
    }

    if (!message || message.length < 5) {
      return NextResponse.json(
        { error: "El mensaje es obligatorio y debe tener al menos 5 caracteres." },
        { status: 400 }
      );
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const status = "recibido";

    await db.execute({
      sql: `INSERT INTO feedback_submissions (id, type, subject, message, email, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, type, subject, message, email, status, now],
    });

    const newFeedback = {
      id,
      type,
      subject,
      message,
      email,
      status,
      created_at: now,
    };

    return NextResponse.json(
      {
        success: true,
        message: "¡Gracias por tu aportación! Tu feedback ha sido registrado.",
        feedback: newFeedback,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al procesar el envío de feedback." },
      { status: 500 }
    );
  }
}
