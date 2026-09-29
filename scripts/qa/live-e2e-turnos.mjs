/**
 * ELECTRICISTA360 — E2E DE GEMINI LIVE (PCM real) POR LA URL PÚBLICA
 *
 * Reproduce EXACTAMENTE el camino del móvil: abre la URL pública (sin contraseña),
 * pulsa el botón GEMINI con un GESTO REAL (evento de ratón por DevTools, no
 * `element.click()`: el AudioContext exige activación de usuario de verdad) y
 * registra la conexión Live completa:
 *
 *   LIVE_CONNECT_REQUEST · LIVE_TOKEN · LIVE_WS_CREATING · LIVE_WS_OPEN ·
 *   LIVE_WS_ERROR · LIVE_WS_CLOSE (code+reason) · LIVE_SETUP_SENT · LIVE_SETUP_ACK ·
 *   LIVE_AUDIO_SEND · LIVE_AUDIO_RECEIVED · LIVE_PLAY_START · LIVE_PLAY_END
 *
 * Además lee el panel de DIAGNÓSTICO de la propia pantalla (STATE/WS/CHUNKS/START/
 * PLAYING/ERROR), que es la misma evidencia que ve el usuario en el móvil.
 *
 * NADA ESPERA PARA SIEMPRE: topes por fase, por turno y global.
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_BASE = process.env.E360_URL ?? "https://kathy-til-latest-visited.trycloudflare.com";
const CHROME = process.env.E360_CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PUERTO = Number(process.env.E360_PUERTO ?? 9335);
const TURNOS = Number(process.env.E360_TURNOS ?? 1);
const SEGUNDOS_HABLA = Number(process.env.E360_SEGUNDOS ?? 5);
const TIMEOUT_FASE_MS = Number(process.env.E360_TIMEOUT_FASE_MS ?? 60000);
const TIMEOUT_TOTAL_MS = Number(process.env.E360_TIMEOUT_TOTAL_MS ?? 600000);
const TIMEOUT_CDP_MS = Number(process.env.E360_TIMEOUT_CDP_MS ?? 15000);
const WAV = process.env.E360_WAV ?? join(tmpdir(), "e360-qa", "frase.wav");

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function conTope(p, ms, etiqueta) {
  return new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(new Error(`TOPE:${etiqueta}:${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(reloj);
        resolver(v);
      },
      (e) => {
        clearTimeout(reloj);
        rechazar(e);
      }
    );
  });
}

/** ------------------------------------------------- instrumentación Live ---- */
function instrumentacionLive() {
  const w = window;
  const L = {
    marcas: [],
    ws: [],
    recibidos: 0,
    bytesRecibidos: 0,
    frames: [],
    setupEnviado: null,
    setupAck: false,
    audioEnviado: 0,
    audioRecibido: 0,
    close: null,
    errorEvento: null,
    token: null,
    sockets: [],
    handles: [],
    cerrarSocketForzado: null,
  };
  w.__qaLive = L;
  const marca = (n, d) => L.marcas.push({ n, t: Date.now(), d: d ?? null });
  /**
   * Corta el socket como lo haría la red del móvil.
   *
   * OJO: `close(1006)` NO vale — 1006 está reservado y `close()` lanza
   * InvalidAccessError, así que el "corte" no ocurría (el arnés se lo tragaba).
   * Se usa 4000, que sí es un cierre válido y dispara `onclose` de verdad.
   */
  w.__qaCortarSocket = () => {
    const s = L.sockets[L.sockets.length - 1];
    if (!s) return { ok: false, motivo: "sin-socket" };
    try {
      s.close(4000, "corte-de-red-simulado");
      return { ok: true, estado: s.readyState };
    } catch (e) {
      return { ok: false, motivo: String(e && e.message ? e.message : e) };
    }
  };

  let WSOriginal = w.WebSocket;
  const Envuelto = function (url, protocolos) {
    const u = String(url);
    const socket = protocolos === undefined ? new WSOriginal(url) : new WSOriginal(url, protocolos);
    const esLive = /generativelanguage\.googleapis\.com/.test(u);
    if (!esLive) return socket;

    const entrada = { host: "?", tieneToken: /access_token=/.test(u), eventos: [] };
    try {
      entrada.host = new URL(u).host;
    } catch (e) {
      /* ignore */
    }
    L.ws.push(entrada);
    L.sockets.push(socket);
    marca("LIVE_WS_CREATING", { host: entrada.host, tieneToken: entrada.tieneToken });

    socket.addEventListener("open", () => {
      entrada.eventos.push("open");
      marca("LIVE_WS_OPEN");
    });
    socket.addEventListener("error", () => {
      entrada.eventos.push("error");
      L.errorEvento = "error";
      marca("LIVE_WS_ERROR", { listoEstado: socket.readyState });
    });
    socket.addEventListener("close", (ev) => {
      entrada.eventos.push("close");
      L.close = { code: ev.code, reason: String(ev.reason || "").slice(0, 200), wasClean: ev.wasClean };
      marca("LIVE_WS_CLOSE", L.close);
    });
    socket.addEventListener("message", (ev) => {
      L.recibidos += 1;
      const datos = ev.data;
      if (typeof datos === "string") {
        procesarTexto(datos, datos.length);
        return;
      }
      if (datos instanceof ArrayBuffer) {
        L.bytesRecibidos += datos.byteLength;
        try {
          procesarTexto(new TextDecoder().decode(new Uint8Array(datos)), datos.byteLength);
        } catch (e) {
          /* ignore */
        }
        return;
      }
      if (datos && typeof datos.text === "function") {
        datos
          .text()
          .then((t) => procesarTexto(t, t.length))
          .catch(() => undefined);
      }
    });

    const procesarTexto = (texto, tam) => {
      L.bytesRecibidos += tam;
      if (L.frames.length < 8) L.frames.push(texto.slice(0, 160));
      let j = null;
      try {
        j = JSON.parse(texto);
      } catch (e) {
        return;
      }
      if (j && j.setupComplete) {
        L.setupAck = true;
        marca("LIVE_SETUP_ACK", { sessionId: j.setupComplete.sessionId ?? null });
        return;
      }
      // El servidor ofrece reanudación: se registra para saber si el cliente la usa.
      const resumen = j?.sessionResumptionUpdate;
      if (resumen) {
        L.handles.push({ handle: resumen.newHandle ?? null, resumable: !!resumen.resumable });
        marca("LIVE_RESUMPTION_UPDATE", { resumable: !!resumen.resumable, handleLen: resumen.newHandle ? String(resumen.newHandle).length : 0 });
        return;
      }
      if (j && j.error) {
        marca("LIVE_SERVER_ERROR", { code: j.error.code ?? null, message: String(j.error.message || "").slice(0, 200) });
        return;
      }
      const partes = j?.serverContent?.modelTurn?.parts ?? j?.serverContent?.turnComplete ? j.serverContent?.modelTurn?.parts ?? [] : [];
      const conAudio = (partes ?? []).filter((p) => p && p.inlineData && p.inlineData.data);
      if (conAudio.length) {
        L.audioRecibido += conAudio.length;
        if (L.audioRecibido <= 3) {
          marca("LIVE_AUDIO_RECEIVED", { partes: conAudio.length, mime: conAudio[0].inlineData.mimeType ?? null, b64: String(conAudio[0].inlineData.data).length });
        }
        return;
      }
      if (j?.serverContent?.turnComplete) marca("LIVE_TURN_COMPLETE");
      if (j?.serverContent?.interrupted) marca("LIVE_INTERRUPTED");
    };

    const sendOriginal = socket.send.bind(socket);
    socket.send = (datos) => {
      if (typeof datos === "string") {
        let j = null;
        try {
          j = JSON.parse(datos);
        } catch (e) {
          /* ignore */
        }
        if (j && j.setup) {
          L.setupEnviado = j.setup;
          marca("LIVE_SETUP_SENT", {
            model: j.setup.model ?? null,
            modalidades: j.setup.generationConfig?.responseModalities ?? null,
            transcripcion: !!(j.setup.inputAudioTranscription || j.setup.outputAudioTranscription),
          });
        } else if (j && j.realtimeInput) {
          L.audioEnviado += 1;
          if (L.audioEnviado <= 2) marca("LIVE_AUDIO_SEND", { claves: Object.keys(j.realtimeInput) });
        } else if (j && j.clientContent) {
          L.audioEnviado += 1;
          if (L.audioEnviado <= 2) marca("LIVE_AUDIO_SEND", { tipo: "clientContent" });
        } else if (L.audioEnviado === 0) {
          marca("LIVE_SEND_DESCONOCIDO", { claves: Object.keys(j ?? {}).slice(0, 5) });
        }
      } else {
        L.audioEnviado += 1;
      }
      return sendOriginal(datos);
    };

    return socket;
  };
  Envuelto.prototype = WSOriginal.prototype;
  Envuelto.CONNECTING = 0;
  Envuelto.OPEN = 1;
  Envuelto.CLOSING = 2;
  Envuelto.CLOSED = 3;
  w.WebSocket = Envuelto;

  // Token: la clave maestra NUNCA viaja al cliente; se comprueba qué devuelve.
  const fetchOriginal = w.fetch.bind(w);
  w.fetch = async (recurso, opciones) => {
    const url = String(recurso && recurso.url ? recurso.url : recurso);
    if (url.includes("/api/asistente/gemini-live/token")) {
      marca("LIVE_CONNECT_REQUEST");
      const r = await fetchOriginal(recurso, opciones);
      let info = { status: r.status };
      try {
        const j = await r.clone().json();
        info = {
          status: r.status,
          model: j.model ?? null,
          tieneToken: !!j.token,
          tokenLen: j.token ? String(j.token).length : 0,
          error: j.error ?? null,
        };
      } catch (e) {
        info.error = "sin-json";
      }
      L.token = info;
      marca("LIVE_TOKEN", info);
      return r;
    }
    return fetchOriginal(recurso, opciones);
  };
}

function utilidadesLive() {
  const qa = {};
  qa.clicsVistos = [];
  // ESPÍA DE CLICS: demuestra si el gesto real llega al botón o a otra cosa.
  document.addEventListener(
    "click",
    (ev) => {
      const t = ev.target;
      const b = t && t.closest ? t.closest("button") : null;
      qa.clicsVistos.push({
        t: Date.now(),
        etiqueta: t && t.tagName ? t.tagName : "?",
        botonAria: b ? b.getAttribute("aria-label") : null,
        botonTexto: b ? (b.textContent || "").trim().slice(0, 20) : null,
        x: Math.round(ev.clientX),
        y: Math.round(ev.clientY),
        confiable: ev.isTrusted,
      });
    },
    true
  );
  qa.botonGemini = () =>
    [...document.querySelectorAll("button")].find(
      (b) => (b.getAttribute("aria-label") || "").includes("Hablar con Gemini")
    );
  qa.botonAltavoz = () =>
    [...document.querySelectorAll("button")].find((b) =>
      (b.getAttribute("aria-label") || "").includes("Probar altavoz")
    );
  qa.marcas = () => window.__qaLive;
  /** Lee el panel de DIAGNÓSTICO tal cual lo ve el usuario en el móvil. */
  qa.diag = () => {
    const salida = {};
    for (const span of document.querySelectorAll("span")) {
      const t = (span.textContent || "").trim();
      const m = /^([A-Z][A-Z ]{1,20})=(.+)$/.exec(t);
      if (m) salida[m[1].trim()] = m[2].trim().slice(0, 60);
    }
    const aviso = document.querySelector('[role="alert"]');
    salida.AVISO = aviso ? aviso.textContent.trim().slice(0, 160) : "";
    const cab = [...document.querySelectorAll("span")].find((s) => (s.textContent || "").startsWith("LIVE:"));
    salida.CABECERA = cab ? cab.textContent.trim().slice(0, 80) : "";
    return salida;
  };
  qa.rect = (selectorFn) => {
    const b = qa[selectorFn]();
    if (!b) return null;
    b.scrollIntoView({ block: "center" });
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
  };
  qa.sondaBotones = () => {
    const claveProps = (n) => Object.keys(n).find((k) => k.startsWith("__reactProps$")) ?? null;
    const describir = (b) => {
      if (!b) return null;
      const clave = claveProps(b);
      const props = clave ? b[clave] : null;
      return {
        texto: (b.textContent || "").trim().slice(0, 20),
        aria: b.getAttribute("aria-label"),
        tienePropsReact: !!clave,
        tieneOnClick: !!(props && props.onClick),
        deshabilitado: !!b.disabled,
        visible: !!(b.offsetWidth && b.offsetHeight),
      };
    };
    return {
      gemini: [...document.querySelectorAll("button")]
        .filter((b) => (b.getAttribute("aria-label") || "").includes("Hablar con Gemini"))
        .map(describir),
      altavoz: [...document.querySelectorAll("button")]
        .filter((b) => (b.getAttribute("aria-label") || "").includes("Probar altavoz"))
        .map(describir),
      dictar: [...document.querySelectorAll("button")]
        .filter((b) => /^(Dictar|Detener)$/.test((b.textContent || "").trim()))
        .map(describir),
    };
  };
  qa.clicJS = (cual) => {
    const b = cual === "gemini" ? qa.botonGemini() : qa.botonAltavoz();
    if (!b) return false;
    b.click();
    return true;
  };
  window.__qaApp = qa;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pendientes = new Map();
    this.consola = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === "Runtime.consoleAPICalled") {
        this.consola.push(
          (msg.params?.args ?? []).map((a) => (a.value !== undefined ? String(a.value) : a.description ?? "")).join(" ")
        );
        return;
      }
      const p = this.pendientes.get(msg.id);
      if (!p) return;
      this.pendientes.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return conTope(
      new Promise((resolve, reject) => {
        this.pendientes.set(id, { resolve, reject });
        this.ws.send(JSON.stringify({ id, method, params }));
      }),
      TIMEOUT_CDP_MS,
      `cdp:${method}`
    ).finally(() => this.pendientes.delete(id));
  }
  async evaluar(expresion, awaitPromise = true) {
    const r = await this.send("Runtime.evaluate", { expression: expresion, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error("EVAL: " + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)));
    }
    return r.result?.value;
  }
  /** CLIC REAL (gesto de usuario de verdad): un `.click()` por JS no activa AudioContext. */
  async clicReal(x, y) {
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", clickCount: 0 });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await dormir(60);
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }
}

async function pedirJson(url, ms = 5000) {
  const c = new AbortController();
  const reloj = setTimeout(() => c.abort(), ms);
  try {
    return await (await fetch(url, { signal: c.signal })).json();
  } finally {
    clearTimeout(reloj);
  }
}

function matarChrome(p) {
  if (!p || p.killed) return;
  try {
    spawnSync("taskkill", ["/PID", String(p.pid), "/T", "/F"], { stdio: "ignore" });
  } catch (e) {
    /* ignore */
  }
  try {
    p.kill("SIGKILL");
  } catch (e) {
    /* ignore */
  }
}

let chromeGlobal = null;
let informeGlobal = null;
setTimeout(() => {
  console.error(`\n[LIVE] TOPE GLOBAL (${TIMEOUT_TOTAL_MS} ms): se cierra y se mata Chrome.`);
  if (informeGlobal) console.error("[LIVE] INFORME PARCIAL " + JSON.stringify(informeGlobal));
  matarChrome(chromeGlobal);
  process.exit(3);
}, TIMEOUT_TOTAL_MS);

async function principal() {
  if (!existsSync(CHROME)) throw new Error(`No se encuentra Chrome en ${CHROME}`);
  if (!existsSync(WAV)) throw new Error(`No existe el audio de prueba: ${WAV}`);

  const perfil = mkdtempSync(join(tmpdir(), "e360-live-"));
  const args = [
    "--headless=new",
    `--remote-debugging-port=${PUERTO}`,
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${WAV}`,
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=420,900",
    "--lang=es-ES",
    "about:blank",
  ];
  const chrome = spawn(CHROME, args, { stdio: "ignore" });
  chromeGlobal = chrome;
  const informe = { url: URL_BASE, turnosPedidos: TURNOS, fases: [] };
  informeGlobal = informe;

  try {
    for (let i = 0; i < 60; i += 1) {
      try {
        await pedirJson(`http://127.0.0.1:${PUERTO}/json/version`, 2000);
        break;
      } catch (e) {
        await dormir(250);
      }
    }
    let pagina = null;
    for (let i = 0; i < 60 && !pagina; i += 1) {
      try {
        const lista = await pedirJson(`http://127.0.0.1:${PUERTO}/json/list`, 2000);
        pagina = lista.find((t) => t.type === "page" && t.webSocketDebuggerUrl) ?? null;
      } catch (e) {
        /* reintento */
      }
      if (!pagina) await dormir(250);
    }
    if (!pagina) throw new Error("No hay pestaña que controlar");

    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await conTope(
      new Promise((res, rej) => {
        ws.onopen = res;
        ws.onerror = () => rej(new Error("No se pudo conectar a DevTools"));
      }),
      10000,
      "ws"
    );
    const cdp = new Cdp(ws);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(${instrumentacionLive.toString()})();` });

    console.log(`ABRIR: ${URL_BASE}/asistente`);
    await cdp.send("Page.navigate", { url: `${URL_BASE}/asistente` });
    for (let i = 0; i < 80; i += 1) {
      const listo = await cdp.evaluar(
        `!!document.querySelector('textarea[placeholder^="Habla o escribe"]') && !location.pathname.startsWith('/login')`
      );
      if (listo) break;
      await dormir(500);
    }
    informe.abrioSinPassword = await cdp.evaluar(`!location.pathname.startsWith('/login')`);
    await cdp.evaluar(`(${utilidadesLive.toString()})(); true;`);
    /**
     * HIDRATACIÓN DE VERDAD. El botón existe en el HTML del servidor desde el primer
     * instante (por eso "se ve"), pero hasta que React no le ata su manejador el clic
     * se pierde EN SILENCIO: es exactamente lo que se midió (clic real recibido por
     * el botón y ninguna consecuencia). La sonda buena es el fiber de React.
     */
    informe.paginaHidratada = false;
    for (let i = 0; i < 120; i += 1) {
      const h = await cdp.evaluar(
        `(() => { const b = window.__qaApp.botonGemini();
                  if (!b) return false;
                  return Object.keys(b).some(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$')); })()`
      );
      if (h) {
        informe.paginaHidratada = true;
        break;
      }
      await dormir(500);
    }
    informe.hidratada = informe.paginaHidratada;
    informe.entorno = await cdp.evaluar(
      `({ secure: window.isSecureContext, ws: typeof window.WebSocket, audio: typeof (window.AudioContext||window.webkitAudioContext) })`
    );

    // ── PULSAR GEMINI CON GESTO REAL ─────────────────────────────────────────
    const rect = await cdp.evaluar(`window.__qaApp.rect('botonGemini')`);
    console.log(`  clic real en GEMINI @ ${JSON.stringify(rect)} (hidratada=${informe.paginaHidratada})`);
    informe.clic = rect;
    // Se intenta el GESTO REAL (activa AudioContext de verdad) y, si no hay efecto
    // observable, se reintenta: un clic perdido no puede confundirse con un fallo.
    let efecto = false;
    for (let intento = 1; intento <= 3 && !efecto; intento += 1) {
      const r = await cdp.evaluar(`window.__qaApp.rect('botonGemini')`);
      await cdp.clicReal(r.x, r.y);
      await dormir(2500);
      const live = await cdp.evaluar("window.__qaLive");
      const d = await cdp.evaluar("window.__qaApp.diag()");
      efecto = (live?.ws?.length ?? 0) > 0 || !!d?.STATE;
      console.log(`  intento ${intento}: ws=${live?.ws?.length ?? 0} token=${JSON.stringify(live?.token ?? null)} panel=${d?.STATE ?? "sin-panel"}`);
    }
    informe.clicsVistos = await cdp.evaluar("window.__qaApp.clicsVistos");
    informe.estadoTrasClic = await cdp.evaluar("window.__qaApp.diag()");
    console.log(`  tras el clic: ${JSON.stringify(informe.estadoTrasClic)}`);

    // Esperar a la conexión (o al error REAL).
    const finConexion = Date.now() + TIMEOUT_FASE_MS;
    let conexion = null;
    for (;;) {
      conexion = await cdp.evaluar("window.__qaLive");
      if (conexion && (conexion.setupAck || conexion.close || conexion.errorEvento)) break;
      if (Date.now() > finConexion) break;
      await dormir(500);
    }
    informe.conexion = {
      token: conexion?.token ?? null,
      wsCreados: conexion?.ws?.length ?? 0,
      wsHost: conexion?.ws?.[0]?.host ?? null,
      tieneToken: conexion?.ws?.[0]?.tieneToken ?? false,
      setupEnviado: conexion?.setupEnviado ?? null,
      setupAck: conexion?.setupAck ?? false,
      close: conexion?.close ?? null,
      errorEvento: conexion?.errorEvento ?? null,
      framesRecibidos: conexion?.frames ?? [],
    };
    console.log(`CONEXIÓN: setupAck=${informe.conexion.setupAck} close=${JSON.stringify(informe.conexion.close)} token=${JSON.stringify(informe.conexion.token)}`);
    if (informe.conexion.setupEnviado) console.log(`  setup enviado: ${JSON.stringify(informe.conexion.setupEnviado)}`);
    for (const f of informe.conexion.framesRecibidos) console.log(`  frame: ${f}`);

    // ── CORTE DE RED SIMULADO (lo que le pasa al móvil de verdad) ────────────
    if (process.env.E360_CORTAR_SOCKET === "1") {
      console.log("CORTE: se cierra el WebSocket Live a lo bruto (1006) y se observa la reacción…");
      const antesCorte = await cdp.evaluar("({ live: window.__qaLive, diag: window.__qaApp.diag() })");
      informe.antesDelCorte = { sockets: antesCorte?.live?.sockets?.length ?? 0, diag: antesCorte?.diag ?? {} };
      await cdp.evaluar("window.__qaCortarSocket(4000)");
      const resultadoCorte = await cdp.evaluar("window.__qaCortarSocket ? true : false");
      informe.corteEjecutado = resultadoCorte;
      await dormir(3000);
      const trasCorte = await cdp.evaluar("({ live: window.__qaLive, diag: window.__qaApp.diag() })");
      informe.trasElCorte = {
        wsCreados: trasCorte?.live?.ws?.length ?? 0,
        setupAck: trasCorte?.live?.setupAck ?? false,
        close: trasCorte?.live?.close ?? null,
        diag: trasCorte?.diag ?? {},
      };
      console.log(`  tras el corte: ws=${informe.trasElCorte.wsCreados} STATE=${informe.trasElCorte.diag.STATE} WS=${informe.trasElCorte.diag.WS} ERROR=${informe.trasElCorte.diag.ERROR}`);
      // ¿Se recupera solo? Se le da tiempo a reconectar y se vuelve a medir.
      await dormir(Number(process.env.E360_ESPERA_RECONEXION_MS ?? 20000));
      const trasEspera = await cdp.evaluar("({ live: window.__qaLive, diag: window.__qaApp.diag() })");
      informe.trasEsperarReconexion = {
        wsCreados: trasEspera?.live?.ws?.length ?? 0,
        setupAck: trasEspera?.live?.setupAck ?? false,
        tokens: trasEspera?.live?.token?.status ?? null,
        diag: trasEspera?.diag ?? {},
      };
      console.log(`  tras esperar reconexión: ws=${informe.trasEsperarReconexion.wsCreados} STATE=${informe.trasEsperarReconexion.diag.STATE} WS=${informe.trasEsperarReconexion.diag.WS}`);
      // Estado equivalente a "el usuario vuelve a pulsar GEMINI" (lo que hace el móvil).
      const r3 = await cdp.evaluar(`window.__qaApp.rect('botonGemini')`);
      await cdp.clicReal(r3.x, r3.y);
      await dormir(3000);
      informe.trasPulsarDeNuevo = await cdp.evaluar("window.__qaApp.diag()");
      console.log(`  tras pulsar GEMINI otra vez: ${JSON.stringify(informe.trasPulsarDeNuevo)}`);
    }

    // ── TURNOS ───────────────────────────────────────────────────────────────
    for (let turno = 1; turno <= TURNOS; turno += 1) {
      const paso = { turno, audioEnviadoAntes: 0, audioRecibidoAntes: 0 };
      const antes = await cdp.evaluar("window.__qaLive");
      paso.audioEnviadoAntes = antes?.audioEnviado ?? 0;
      paso.audioRecibidoAntes = antes?.audioRecibido ?? 0;
      console.log(`TURNO ${turno}/${TURNOS}: hablando ${SEGUNDOS_HABLA}s…`);
      await dormir(SEGUNDOS_HABLA * 1000);
      // Esperar a que Gemini mande audio y se reproduzca.
      const finTurno = Date.now() + TIMEOUT_FASE_MS;
      let estado = null;
      for (;;) {
        estado = await cdp.evaluar("({ live: window.__qaLive, diag: window.__qaApp.diag() })");
        const recibio = (estado?.live?.audioRecibido ?? 0) > paso.audioRecibidoAntes;
        const reprodujo = /YES/.test(estado?.diag?.PLAYING ?? "") || Number(estado?.diag?.START ?? 0) > 0;
        if (recibio && reprodujo) break;
        if (estado?.live?.close) break;
        if (Date.now() > finTurno) break;
        await dormir(500);
      }
      paso.live = {
        audioEnviado: estado?.live?.audioEnviado ?? 0,
        audioRecibido: estado?.live?.audioRecibido ?? 0,
        setupAck: estado?.live?.setupAck ?? false,
        close: estado?.live?.close ?? null,
      };
      paso.diag = estado?.diag ?? {};
      paso.marcas = (estado?.live?.marcas ?? []).map((m) => m.n);
      informe.fases.push(paso);
      console.log(`  audio enviado=${paso.live.audioEnviado} recibido=${paso.live.audioRecibido}`);
      console.log(`  DIAG: STATE=${paso.diag.STATE} WS=${paso.diag.WS} CTX=${paso.diag.CTX} MIC=${paso.diag.MIC} GEMINI_AUDIO=${paso.diag["GEMINI AUDIO"]} CHUNKS=${paso.diag.CHUNKS} START=${paso.diag.START} ENDED=${paso.diag.ENDED} PLAYING=${paso.diag.PLAYING} ERROR=${paso.diag.ERROR}`);
      if (paso.diag.AVISO) console.log(`  AVISO: ${paso.diag.AVISO}`);
    }

    informe.logs = cdp.consola.slice(-30);
    const ultimo = informe.fases[informe.fases.length - 1] ?? {};
    informe.veredicto = {
      abrioSinPassword: informe.abrioSinPassword,
      wsCreado: informe.conexion.wsCreados > 0,
      wsOpen: (informe.conexion.framesRecibidos.length > 0) || informe.conexion.setupAck,
      setupAck: informe.conexion.setupAck,
      close: informe.conexion.close,
      audioEnviado: ultimo.live?.audioEnviado ?? 0,
      audioRecibido: ultimo.live?.audioRecibido ?? 0,
      diag: ultimo.diag ?? {},
      PASS:
        informe.conexion.setupAck === true &&
        (ultimo.live?.audioEnviado ?? 0) > 0 &&
        (ultimo.live?.audioRecibido ?? 0) > 0 &&
        Number(ultimo.diag?.START ?? 0) > 0,
    };
  } finally {
    matarChrome(chrome);
  }

  console.log("\n=== VEREDICTO ===");
  console.log(JSON.stringify(informe.veredicto, null, 1));
  console.log("INFORME_JSON " + JSON.stringify(informe));
  process.exit(informe.veredicto?.PASS ? 0 : 2);
}

principal().catch((e) => {
  console.error("FALLO:", e.message);
  matarChrome(chromeGlobal);
  if (informeGlobal) console.error("INFORME_PARCIAL " + JSON.stringify(informeGlobal));
  process.exit(1);
});
