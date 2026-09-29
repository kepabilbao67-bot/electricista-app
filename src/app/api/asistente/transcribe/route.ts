import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "STT_NOT_CONFIGURED" }, { status: 503 });
    }

    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "AUDIO_REQUIRED" }, { status: 400 });
    }
    if (audio.size <= 0 || audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "AUDIO_SIZE_INVALID" }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append("file", audio, audio.name || "dictado.webm");
    upstream.append("model", process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe");
    upstream.append("language", "es");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstream,
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({})) as { text?: string; error?: { message?: string } };
    if (!response.ok) {
      console.error("[VOZ360][STT] transcription upstream error", {
        status: response.status,
        message: body?.error?.message || "unknown",
      });
      return NextResponse.json({ error: "STT_UPSTREAM_ERROR" }, { status: 502 });
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "STT_EMPTY" }, { status: 422 });
    }

    return NextResponse.json(
      { text },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[VOZ360][STT] transcription failed", error);
    return NextResponse.json({ error: "STT_INTERNAL_ERROR" }, { status: 500 });
  }
}
