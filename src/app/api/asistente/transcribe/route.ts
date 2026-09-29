import { NextRequest, NextResponse } from "next/server";

/**
 * ELECTRICISTA360 — TRANSCRIPCIÓN DE AUDIO PARA EL DICTADO (fallback de "Dictar")
 *
 * Contrato: `POST` multipart con el campo `audio` → `{ text }`.
 *
 * POR QUÉ EXISTE
 * El dictado del asistente usaba sólo la Web Speech API del navegador. Cuando esa
 * API no existe (Firefox, muchos WebView) o falla con "network" /
 * "service-not-allowed" / "not-allowed" —lo habitual en móvil— el usuario pulsaba
 * "Dictar", hablaba y NO aparecía ningún texto. Esta ruta es la otra mitad de la
 * solución: el navegador graba con MediaRecorder y aquí se transcribe en el
 * servidor.
 *
 * SEGURIDAD
 * Las claves viven SOLO aquí (servidor). El navegador nunca las ve: manda su audio
 * a esta ruta y recibe únicamente `{ text }`. Los logs no contienen claves ni audio.
 *
 * PROVEEDORES (por orden, el primero configurado que responda)
 *   1. OpenAI (`OPENAI_API_KEY`)      → /v1/audio/transcriptions
 *   2. Google (`GEMINI_API_KEY`/`GOOGLE_API_KEY`) → generateContent con el audio
 *      incrustado, en un modelo de transcripción.
 *
 * El segundo no es un capricho: si el despliegue no tiene clave de OpenAI, sin él
 * el fallback devolvería 503 y el botón "Dictar" seguiría sin funcionar. Es
 * preferible tener una segunda vía a quedarse mudo. Para dejar SOLO OpenAI basta
 * con no definir la clave de Google en el entorno.
 *
 * CÓDIGOS DE RESPUESTA (los que interpreta el componente)
 *   200 { text }                → texto reconocido
 *   400 AUDIO_REQUIRED / AUDIO_SIZE_INVALID
 *   422 STT_EMPTY               → había audio pero NO voz (el usuario debe saberlo)
 *   502 STT_UPSTREAM_ERROR      → el proveedor falló
 *   503 STT_NOT_CONFIGURED      → no hay ningún proveedor de voz configurado
 *   500 STT_INTERNAL_ERROR
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/** Respuesta uniforme de error (nunca incluye detalles del proveedor ni claves). */
function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function claveOpenAI(): string | null {
  const valor = (process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "").trim();
  return valor.length > 0 ? valor : null;
}

function claveGoogle(): string | null {
  const valor = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  return valor.length > 0 ? valor : null;
}

interface ResultadoTranscripcion {
  text: string | null;
  /** ¿Falló el proveedor (error de red/servidor) o simplemente no había voz? */
  falloProveedor: boolean;
}

/**
 * Tipo de audio REAL, deducido de los bytes.
 *
 * COMPROBADO CONTRA LA API REAL (y contra lo que parecía obvio):
 *   - El proveedor de Google ACEPTA un WAV con su cabecera (`audio/wav` → 200 con
 *     la transcripción literal) y RECHAZA el mismo audio como PCM crudo
 *     (`audio/pcm;rate=…` → 400 "Request contains an invalid argument"). Así que
 *     aquí NO se separa la cabecera: se manda el fichero tal cual.
 *   - El tipo se deduce de la CABECERA, no de lo que declare el cliente: un
 *     navegador que etiquete mal su propio audio no debe tumbar el dictado.
 */
function tipoAudioReal(bytes: Buffer, declarado: string): string {
  if (bytes.length >= 12) {
    if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE") {
      return "audio/wav";
    }
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return "audio/webm";
    }
    if (bytes.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
    if (bytes.toString("ascii", 4, 8) === "ftyp") return "audio/mp4";
    if (bytes.toString("ascii", 0, 3) === "ID3") return "audio/mpeg";
  }
  return declarado.startsWith("audio/") ? declarado : "audio/webm";
}

/**
 * ¿Merece la pena reintentar este fallo del proveedor?
 *
 * MEDIDO EN REAL: dictando en ciclos seguidos, el proveedor de Google contestó
 * varias veces 429 ("You exceeded your current quota") y ese dictado se perdía con
 * un error, aunque el siguiente funcionara. Con el reintento el hipo del proveedor
 * (límite por minuto) deja de llegar al usuario.
 */
function esReintentable(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

/**
 * Espera entre intentos.
 *
 * MEDIDO: con 700 ms el segundo intento volvía a recibir 429 cuando la cuota por
 * minuto está agotada, así que se sube a 1,5 s (cabe de sobra en el tope de 20 s
 * que aplica el navegador). Una cuota agotada de verdad NO se arregla aquí: en ese
 * caso el usuario ve un mensaje claro y el ciclo queda reutilizable al instante.
 */
const REINTENTO_MS = 1500;

/** Número total de intentos por proveedor (1 + 1 reintento). Acotado a propósito. */
const INTENTOS_POR_PROVEEDOR = 2;

/**
 * Hace la petición al proveedor con UN reintento ante fallo transitorio.
 *
 * El cuerpo se reconstruye en cada intento (una petición ya consumida no se puede
 * reenviar), así que el llamador pasa una función que lo fabrica.
 * `intentos` permite pedir una sola oportunidad (modelo de reserva) para no gastar
 * el presupuesto de tiempo del navegador.
 * Devuelve `null` si se agotaron los intentos sin respuesta utilizable.
 */
async function pedirConReintento(
  peticion: () => Promise<Response>,
  intentos = INTENTOS_POR_PROVEEDOR
): Promise<Response | null> {
  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      const respuesta = await peticion();
      if (respuesta.ok || !esReintentable(respuesta.status) || intento === intentos) {
        return respuesta;
      }
    } catch {
      if (intento === intentos) return null;
    }
    await new Promise((listo) => setTimeout(listo, REINTENTO_MS));
  }
  return null;
}

/** Vía 1: OpenAI (multipart, el motor de dictado de siempre). */
async function transcribirConOpenAI(
  audio: File,
  apiKey: string,
  senal: AbortSignal
): Promise<ResultadoTranscripcion> {
  const construirCuerpo = () => {
    const upstream = new FormData();
    upstream.append("file", audio, audio.name || "dictado.webm");
    upstream.append("model", process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe");
    upstream.append("language", "es");
    return upstream;
  };

  const respuesta = await pedirConReintento(() =>
    fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: construirCuerpo(),
      cache: "no-store",
      signal: senal,
    })
  );
  if (!respuesta) return { text: null, falloProveedor: true };

  const cuerpo = (await respuesta.json().catch(() => ({}))) as {
    text?: string;
    error?: { message?: string };
  };
  if (!respuesta.ok) {
    console.error("[VOZ360][STT] OpenAI fallo", {
      status: respuesta.status,
      message: cuerpo?.error?.message || "unknown",
    });
    return { text: null, falloProveedor: true };
  }
  const texto = typeof cuerpo.text === "string" ? cuerpo.text.trim() : "";
  return { text: texto || null, falloProveedor: false };
}

/**
 * MODELOS DE RESERVA DE GOOGLE.
 *
 * MEDIDO EN REAL, dictando en ciclos seguidos (sonda contra la API con el MISMO
 * audio del dictado):
 *   - `gemini-3.5-transcribe` (el especializado): 429 de cuota agotada SIEMPRE.
 *   - `gemini-3.5-flash`:           429/503 (saturado).
 *   - `gemini-3.6-flash`:           503 "high demand".
 *   - `gemini-3.7-flash`:           200 pero 116 s (inservible para voz).
 *   - `gemini-3.5-flash-lite`:      200 en 1,3 s ✅
 *   - `gemini-3.1-flash-lite`:      200 en 2,1 s ✅
 *
 * Por eso las reservas son los modelos LITE (los que responden rápido y siguen
 * disponibles cuando los "flash" están saturados). Se piden DOS A LA VEZ y gana el
 * primero que traiga texto: los picos son por modelo, así que dos peticiones
 * paralelas multiplican la probabilidad de acertar sin sumar latencia.
 * Se puede cambiar por entorno:
 *   GEMINI_TRANSCRIBE_FALLBACK_MODELS="modelo-a,modelo-b"
 */
const MODELOS_GOOGLE_RESERVA = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

/**
 * Tope de tiempo del SERVIDOR. Tiene que ser MENOR que el del navegador (25 s en
 * `VoiceDictation`): así el servidor contesta siempre antes de que el cliente
 * aborte, y el trabajo no se tira.
 */
const DEADLINE_SERVIDOR_MS = 20000;

/** Resultado de un intento contra UN modelo de Google. */
interface IntentoGoogle {
  text: string | null;
  /** 0 = ni hubo respuesta (red). 200 = respuesta correcta (haya voz o no). */
  status: number;
}

/** Una petición de transcripción a UN modelo concreto. */
async function pedirTranscripcionGoogle(
  modelo: string,
  apiKey: string,
  mime: string,
  base64: string,
  intentos: number,
  senal: AbortSignal
): Promise<IntentoGoogle> {
  const construirCuerpo = () =>
    JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                "Transcribe literalmente el audio en español. Devuelve SOLO la transcripción, " +
                "sin comillas, sin comentarios y sin puntuación añadida.",
            },
            { inlineData: { mimeType: mime, data: base64 } },
          ],
        },
      ],
    });

  const respuesta = await pedirConReintento(
    () =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: construirCuerpo(),
        cache: "no-store",
        signal: senal,
      }),
    intentos
  );
  if (!respuesta) return { text: null, status: 0 };

  const cuerpo = (await respuesta.json().catch(() => ({}))) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; audioTranscription?: { text?: string } }> };
    }>;
    error?: { message?: string };
  };

  if (!respuesta.ok) {
    console.error("[VOZ360][STT] Google fallo", {
      status: respuesta.status,
      modelo,
      mime,
      message: cuerpo?.error?.message?.slice(0, 200) || "unknown",
    });
    return { text: null, status: respuesta.status };
  }

  const partes = cuerpo.candidates?.[0]?.content?.parts ?? [];
  const texto = partes
    .map((p) => (p.text ?? p.audioTranscription?.text ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  return { text: texto || null, status: respuesta.status };
}

/**
 * Carrera de reservas: devuelve el PRIMER texto disponible y ABORTA el resto.
 *
 * POR QUÉ ASÍ (medido): pedir dos modelos a la vez solo ayuda si NO se espera al
 * más lento. Un modelo en "high demand" puede tardar más que el tope del navegador
 * —se midieron ciclos de 33 s que acabaron en "no se pudo transcribir" aunque el
 * texto llegara tarde— así que en cuanto uno trae texto se cortan los demás y se
 * contesta YA. El presupuesto de tiempo lo pone `senal` (el tope del servidor).
 */
async function primeraReservaConTexto(
  reservas: string[],
  apiKey: string,
  mime: string,
  base64: string,
  senal: AbortSignal
): Promise<IntentoGoogle | null> {
  if (reservas.length === 0) return null;
  const propios = reservas.map(() => new AbortController());
  for (const propio of propios) {
    if (senal.aborted) propio.abort();
    else senal.addEventListener("abort", () => propio.abort(), { once: true });
  }
  const abortarResto = (excepto: number) => {
    propios.forEach((controlador, indice) => {
      if (indice === excepto) return;
      try {
        controlador.abort();
      } catch {
        /* ignore */
      }
    });
  };

  return new Promise<IntentoGoogle | null>((resolver) => {
    let pendientes = reservas.length;
    let cerrado = false;
    const terminar = (valor: IntentoGoogle | null) => {
      if (cerrado) return;
      cerrado = true;
      resolver(valor);
    };

    reservas.forEach((modelo, indice) => {
      void pedirTranscripcionGoogle(modelo, apiKey, mime, base64, 1, propios[indice].signal)
        .then((resultado) => {
          if (resultado.text) {
            abortarResto(indice);
            terminar(resultado);
            return;
          }
          pendientes -= 1;
          if (resultado.status === 200) {
            // Respuesta correcta sin voz: no hay nada más que buscar.
            abortarResto(indice);
            terminar(resultado);
            return;
          }
          if (pendientes === 0) terminar(null);
        })
        .catch(() => {
          pendientes -= 1;
          if (pendientes === 0) terminar(null);
        });
    });
  });
}

/** Vía 2: Google (audio incrustado en base64, tal cual viene). */
async function transcribirConGoogle(
  audio: File,
  apiKey: string,
  senal: AbortSignal
): Promise<ResultadoTranscripcion> {
  const principal = process.env.GEMINI_TRANSCRIBE_MODEL?.trim() || "gemini-3.5-transcribe";
  const reservas = (
    process.env.GEMINI_TRANSCRIBE_FALLBACK_MODELS?.split(",") ?? MODELOS_GOOGLE_RESERVA
  )
    .map((m) => m.trim())
    .filter((m) => m.length > 0 && m !== principal)
    .slice(0, 2);

  const bytes = Buffer.from(await audio.arrayBuffer());
  const mime = tipoAudioReal(bytes, audio.type || "");
  const base64 = bytes.toString("base64");

  // 1) El modelo especializado, con su reintento: es el camino normal.
  const primero = await pedirTranscripcionGoogle(
    principal,
    apiKey,
    mime,
    base64,
    INTENTOS_POR_PROVEEDOR,
    senal
  );
  if (primero.text) return { text: primero.text, falloProveedor: false };
  // Respuesta CORRECTA pero sin voz: no hay nada que arreglar cambiando de modelo
  // (y no se gasta cuota de reserva: el usuario no ha hablado).
  if (primero.status === 200) return { text: null, falloProveedor: false };
  // Error que no es de disponibilidad (clave, audio inválido): tampoco mejora.
  if (primero.status !== 0 && !esReintentable(primero.status)) {
    return { text: null, falloProveedor: true };
  }

  // 2) Reservas A LA VEZ, gana la primera con texto.
  const reserva = await primeraReservaConTexto(reservas, apiKey, mime, base64, senal);
  if (reserva?.text) return { text: reserva.text, falloProveedor: false };
  if (reserva?.status === 200) return { text: null, falloProveedor: false };
  return { text: null, falloProveedor: true };
}

export async function POST(request: NextRequest) {
  /**
   * PRESUPUESTO DE TIEMPO DEL SERVIDOR, POR DEBAJO DEL DEL NAVEGADOR.
   *
   * El cliente aborta a los 25 s (su propio tope) y entonces el dictado se pierde
   * aunque el texto llegue después: se midieron ciclos de 33 s que acabaron en "no
   * se pudo transcribir" con el proveedor tardando más de la cuenta. Cortando aquí
   * (20 s) el servidor SIEMPRE contesta antes: o con el texto, o con un error claro
   * que el usuario puede reintentar al instante.
   */
  const controlador = new AbortController();
  const relojServidor = setTimeout(() => controlador.abort(), DEADLINE_SERVIDOR_MS);
  try {
    const openai = claveOpenAI();
    const google = claveGoogle();
    if (!openai && !google) {
      return errorResponse("STT_NOT_CONFIGURED", 503);
    }

    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      return errorResponse("AUDIO_REQUIRED", 400);
    }
    if (audio.size <= 0 || audio.size > MAX_AUDIO_BYTES) {
      return errorResponse("AUDIO_SIZE_INVALID", 400);
    }

    let huboFallo = false;

    if (openai) {
      const resultado = await transcribirConOpenAI(audio, openai, controlador.signal);
      if (resultado.text) {
        return NextResponse.json(
          { text: resultado.text, provider: "openai" },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      huboFallo = resultado.falloProveedor;
    }

    if (google) {
      const resultado = await transcribirConGoogle(audio, google, controlador.signal);
      if (resultado.text) {
        return NextResponse.json(
          { text: resultado.text, provider: "google" },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      huboFallo = huboFallo || resultado.falloProveedor;
    }

    // Ningún proveedor encontró voz: es un caso legítimo (silencio), no un error
    // interno, y el componente lo traduce a "no se ha oído nada".
    if (!huboFallo) return errorResponse("STT_EMPTY", 422);
    return errorResponse("STT_UPSTREAM_ERROR", 502);
  } catch (error) {
    console.error("[VOZ360][STT] fallo inesperado", error instanceof Error ? error.message : "desconocido");
    return errorResponse("STT_INTERNAL_ERROR", 500);
  } finally {
    // El presupuesto de tiempo se cierra SIEMPRE: no queda ningún temporizador vivo
    // (el dictado puede repetirse tantas veces como el usuario quiera).
    clearTimeout(relojServidor);
  }
}
