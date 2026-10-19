import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";

export const dynamic = "force-dynamic";
const MAX_BYTES = 10 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json", "xml"]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic"]);

function extensionDe(nombre: string): string {
  return nombre.toLowerCase().split(".").pop() ?? "";
}

function tipoNormalizado(file: File): string {
  if (file.type) return file.type;
  const extension = extensionDe(file.name);
  const porExtension: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
    xml: "application/xml",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return porExtension[extension] ?? "application/octet-stream";
}

function esCompatible(file: File): boolean {
  const extension = extensionDe(file.name);
  return TEXT_EXTENSIONS.has(extension) || DOCUMENT_EXTENSIONS.has(extension) || IMAGE_EXTENSIONS.has(extension);
}

async function leerRespaldoOpenAI(file: File, data: Buffer, instruccion?: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const base64 = data.toString("base64");
  const mimeType = tipoNormalizado(file);
  const extension = extensionDe(file.name);
  const document = IMAGE_EXTENSIONS.has(extension)
    ? { type: "input_image", image_url: `data:${mimeType};base64,${base64}`, detail: "high" }
    : { type: "input_file", filename: file.name, file_data: `data:${mimeType};base64,${base64}` };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "user", content: [
          { type: "input_text", text: instruccion || "Extrae fielmente cliente, conceptos, cantidades, precios, IVA y totales. Marca datos ilegibles y no inventes ninguno." },
          document
        ] }],
        max_output_tokens: 2000
      }),
      cache: "no-store"
    });
    if (!response.ok) {
      console.error("[document-reader] backup failed", { status: response.status });
      return null;
    }
    const result = await response.json() as {
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
    };
    return result.output?.flatMap(m => m.content ?? []).filter(c => c.type === "output_text").map(c => c.text ?? "").join("\n").trim() || null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const form = await request.formData().catch(() => null);
  const file = form?.get("archivo");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecciona una foto o documento." }, { status: 400 });
  if (!esCompatible(file) || !file.size || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Formato no compatible. Usa foto, PDF, TXT, CSV, JSON, XML, Word o Excel de hasta 10 MB." },
      { status: 400 }
    );
  }
  const modoPresupuesto = form?.get("modo") === "presupuesto";
  const instruccion = modoPresupuesto ? "Lee el presupuesto manuscrito o escaneado y devuelve SOLO las partidas, una línea por partida, EXACTAMENTE con formato Concepto | cantidad | precio unitario. Usa coma decimal si figura, sin símbolo euro. No incluyas encabezado, cliente, subtotal, IVA ni total. Si un precio o cantidad es ilegible, NO inventes: omite esa partida y menciona lo ilegible al final." : "Extrae fielmente el texto del documento, indicando conceptos, cantidades e importes sin inventarlos.";
  const data = Buffer.from(await file.arrayBuffer());
  if (TEXT_EXTENSIONS.has(extensionDe(file.name))) {
    return NextResponse.json({ texto: data.toString("utf8").slice(0,20000), nombre: file.name });
  }
  // El OCR es independiente de Gemini Live. Se prueba primero el proveedor de respaldo.
  const lectura = await leerRespaldoOpenAI(file, data, instruccion);
  if (lectura) return NextResponse.json({ texto: lectura.slice(0,20000), nombre: file.name, proveedor: "openai" });
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "No hay motor de lectura visual configurado." }, { status: 503 });
  try {
    const models = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
    let upstream: Response | undefined;
    for (const model of models) {
      try {
        upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [
        { text: instruccion },
        { inline_data: { mime_type: tipoNormalizado(file), data: data.toString("base64") } }
      ] }], generationConfig: { temperature: 0.1, maxOutputTokens: 2200 } }),
      cache: "no-store"
      });
        if (upstream.ok || ![404, 429, 500, 502, 503].includes(upstream.status)) break;
      } catch {
        // Timeout o indisponibilidad de un modelo: probar el siguiente.
      }
    }
    if (!upstream) {
      const respaldo = await leerRespaldoOpenAI(file, data, instruccion);
      if (respaldo) return NextResponse.json({ texto: respaldo.slice(0,20000), nombre: file.name, proveedor: "respaldo" });
      return NextResponse.json({ error: "Los lectores visuales no están disponibles." }, { status: 502 });
    }
    if (!upstream.ok) {
      const failure = await upstream.json().catch(() => ({})) as { error?: { message?: string; status?: string } };
      const upstreamCode = failure.error?.status || `HTTP_${upstream.status}`;
      console.error("[document-reader] upstream rejected", { code: upstream.status, reason: upstreamCode });
      const respaldo = await leerRespaldoOpenAI(file, data, instruccion);
      if (respaldo) return NextResponse.json({ texto: respaldo.slice(0,20000), nombre: file.name, proveedor: "respaldo" });
      return NextResponse.json({ error: `Lectura visual no disponible (${upstreamCode}).` }, { status: upstream.status === 429 ? 429 : 502 });
    }
    const json = await upstream.json() as { candidates?: Array<{ content?: { parts?: Array<{text?:string}> } }> };
    const texto = json.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("\n").trim();
    if (!texto) return NextResponse.json({ error: "No se ha podido leer texto del documento." }, { status: 422 });
    return NextResponse.json({ texto: texto.slice(0,20000), nombre: file.name }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "La lectura ha agotado el tiempo o ha fallado. Reintenta con otra foto." }, { status: 502 });
  }
}
