import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { interpretVoiceOrder } from "@/lib/voice-order-service";

const InputSchema = z.object({
  text: z.string().trim().min(3).max(4000).optional(),
  input: z.string().trim().min(3).max(4000).optional(),
  tenantId: z.string().optional(),
  requestId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Introduce un pedido válido" }, { status: 400 });
    }

    const rawText = parsed.data.input || parsed.data.text;
    if (!rawText) {
      return NextResponse.json({ error: "El texto del pedido es obligatorio" }, { status: 400 });
    }

    const tenantId =
      request.headers.get("x-tenant-id") ||
      parsed.data.tenantId ||
      "tenant-default-electricista";

    const requestId =
      parsed.data.requestId ||
      request.headers.get("x-request-id") ||
      undefined;

    const result = await interpretVoiceOrder(rawText, {
      tenantId,
      requestId,
      channel: "electricista_voice_order",
    });

    if (!result.success && result.status === "ERROR") {
      return NextResponse.json({ error: result.error || "No se pudo interpretar el pedido" }, { status: 422 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Error procesando pedido por voz";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
