import { NextRequest, NextResponse } from "next/server";
import {
  listMeasurementRecords,
  saveMeasurementRecord,
  type MeasurementRecordSource,
} from "@/lib/measurements360/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  try {
    const parteId = request.nextUrl.searchParams.get("parte_id")?.trim() || null;
    const clientId = request.nextUrl.searchParams.get("client_id")?.trim() || null;
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") || 30);
    const records = await listMeasurementRecords({
      parteId,
      clientId,
      limit: Number.isFinite(limitRaw) ? limitRaw : 30,
    });
    return json({ records });
  } catch {
    return json({ error: "No se pudieron leer las mediciones." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const value = Number(body.value);
    const source = String(body.source || "calculator") as MeasurementRecordSource;

    const record = await saveMeasurementRecord({
      label: typeof body.label === "string" ? body.label : "",
      kind: typeof body.kind === "string" ? body.kind : "",
      value,
      unit: typeof body.unit === "string" ? body.unit : "",
      source,
      parteId: typeof body.parte_id === "string" ? body.parte_id : null,
      clientId: typeof body.client_id === "string" ? body.client_id : null,
      budgetId: typeof body.budget_id === "string" ? body.budget_id : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      metadata:
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? body.metadata
          : null,
    });

    return json(record, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la medición.";
    const status = /necesita|falta|no es válido|no válido/i.test(message) ? 400 : 500;
    return json({ error: message }, status);
  }
}
