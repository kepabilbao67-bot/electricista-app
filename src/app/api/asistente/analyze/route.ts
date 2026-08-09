import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { parseIntent } from "@/lib/autonomo360/intent-parser";
import { buildBudgetDraft } from "@/lib/autonomo360/budget-draft";

/**
 * POST /api/asistente/analyze
 *
 * Recibe texto libre, lo parsea a intent, genera preview de presupuesto
 * y resuelve el nombre de cliente contra la base de datos.
 *
 * NO persiste nada. Solo devuelve datos para la vista previa.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = typeof body.input === "string" ? body.input.trim() : "";

    if (!input) {
      return NextResponse.json(
        { success: false, error: "Texto de entrada vacío." },
        { status: 400 }
      );
    }

    // Parse intent
    const intent = parseIntent(input);

    if (intent.type === "unknown") {
      return NextResponse.json(
        { success: false, error: "No se reconoció la intención. Intenta con: \"Presupuesto para [cliente], [cantidad] a [precio] euros de [concepto]\"." },
        { status: 200 }
      );
    }

    // Solo soportamos create_budget en esta fase
    if (intent.type !== "create_budget") {
      return NextResponse.json(
        { success: false, error: `Intención "${intent.type}" detectada pero no soportada todavía. Solo se pueden crear presupuestos.` },
        { status: 200 }
      );
    }

    // Build budget draft
    const draftResult = buildBudgetDraft(intent);

    if (!draftResult.success || !draftResult.payload || !draftResult.preview) {
      return NextResponse.json(
        { success: false, error: draftResult.errors.join(" ") },
        { status: 200 }
      );
    }

    // Resolve client name → matches
    let clientMatches: { id: string; name: string }[] = [];
    const clientNameHint = draftResult.payload.client_name_hint;

    if (clientNameHint) {
      await initializeDatabase();
      const db = getDbClient();

      // Búsqueda normalizada: LIKE con el nombre
      const result = await db.execute({
        sql: "SELECT id, name FROM clients WHERE LOWER(name) LIKE LOWER(?) ORDER BY name LIMIT 10",
        args: [`%${clientNameHint}%`],
      });

      clientMatches = result.rows.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name as string,
      }));
    }

    return NextResponse.json({
      success: true,
      intentType: intent.type,
      confidence: intent.confidence,
      preview: {
        clientNameHint,
        clientId: clientMatches.length === 1 ? clientMatches[0].id : null,
        clientMatches,
        items: draftResult.payload.items,
        taxRate: draftResult.payload.tax_rate,
        subtotal: draftResult.preview.subtotal,
        taxAmount: draftResult.preview.taxAmount,
        total: draftResult.preview.total,
        warnings: draftResult.warnings,
        missingFields: intent.missingFields,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Error interno del asistente." },
      { status: 500 }
    );
  }
}
