/**
 * ELECTRICISTA360 — E2E DE VOZ POR LA URL PÚBLICA (móvil simulado)
 *
 * Recorre EXACTAMENTE el camino del encargo, sobre la URL HTTPS pública (la misma
 * que abre el móvil), sin teclear contraseña:
 *
 *   ABRIR → (acceso QA automático) → HABLAR → ENTENDER → RESPONDER → OÍR → repetir
 *
 * NO se presupone qué motor se usa: se INSTRUMENTA la página y se registran los
 * marcadores reales, de modo que el primer punto que NO ocurre queda identificado
 * por evidencia y no por suposición:
 *
 *   MIC_OPEN · STT_START · STT_TEXT · ASSISTANT_REQUEST · ASSISTANT_RESPONSE ·
 *   TTS_REQUEST · TTS_READY · PLAY_STARTED · PLAY_ENDED · PLAY_ERROR
 *
 * NADA ESPERA PARA SIEMPRE: topes por marcador, por ciclo y global.
 *
 * Variables:
 *   E360_URL=<url pública o local>   (por defecto el túnel actual)
 *   E360_CICLOS=3                    conversaciones consecutivas SIN recargar
 *   E360_SEGUNDOS=7                  segundos hablando en cada turno
 *   E360_SIN_WEBSPEECH=1             fuerza la vía de grabación+servidor
 *   E360_TIMEOUT_CICLO_MS=120000     tope por conversación
 *   E360_TIMEOUT_TOTAL_MS=600000     tope global
 *   E360_TIMEOUT_CDP_MS=15000        tope por llamada a DevTools
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_BASE = process.env.E360_URL ?? "https://kathy-til-latest-visited.trycloudflare.com";
const CHROME = process.env.E360_CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PUERTO = Number(process.env.E360_PUERTO ?? 9334);
const CICLOS = Number(process.env.E360_CICLOS ?? 3);
const SEGUNDOS = Number(process.env.E360_SEGUNDOS ?? 7);
const SIN_WEBSPEECH = process.env.E360_SIN_WEBSPEECH === "1";
const TIMEOUT_CICLO_MS = Number(process.env.E360_TIMEOUT_CICLO_MS ?? 120000);
const TIMEOUT_TOTAL_MS = Number(process.env.E360_TIMEOUT_TOTAL_MS ?? 600000);
const TIMEOUT_CDP_MS = Number(process.env.E360_TIMEOUT_CDP_MS ?? 15000);
const WAV = process.env.E360_WAV ?? join(tmpdir(), "e360-qa", "frase.wav");

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function conTope(promesa, ms, etiqueta) {
  return new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(new Error(`TOPE:${etiqueta}:${ms}ms`)), ms);
    promesa.then(
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

/** ---------------------------------------------------------------- marcadores */
function instrumentacion() {
  const w = window;
  const m = {
    marcas: [],
    tts: { disponible: typeof w.speechSynthesis !== "undefined", voces: -1, peticiones: 0 },
    sttTexto: "",
    asistente: { peticion: null, respuesta: null, http: null, error: null },
    play: { started: 0, ended: 0, error: 0, ultimoError: null, ultimoTexto: null },
    mic: 0,
  };
  w.__qaMarcas = m;
  const marca = (nombre, dato) => {
    m.marcas.push({ nombre, t: Date.now(), dato: dato ?? null });
  };
  marca("INSTRUMENTADO");
  if (m.tts.disponible) {
    try {
      m.tts.voces = w.speechSynthesis.getVoices().length;
      w.speechSynthesis.addEventListener?.("voiceschanged", () => {
        m.tts.voces = w.speechSynthesis.getVoices().length;
      });
    } catch (e) {
      /* ignore */
    }
  }

  // MIC_OPEN
  try {
    const md = navigator.mediaDevices;
    if (md && md.getUserMedia) {
      const original = md.getUserMedia.bind(md);
      md.getUserMedia = async (c) => {
        const s = await original(c);
        m.mic += 1;
        marca("MIC_OPEN", { pistas: s.getTracks().length, dispositivo: c && c.audio ? "audio" : "otro" });
        return s;
      };
    }
  } catch (e) {
    /* ignore */
  }

  // STT_START (Web Speech) — se instrumenta si existe.
  try {
    for (const nombre of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      const Original = w[nombre];
      if (typeof Original !== "function") continue;
      const Envuelto = function (...args) {
        const inst = new Original(...args);
        const startOriginal = inst.start.bind(inst);
        inst.start = (...x) => {
          marca("STT_START", { motor: nombre });
          return startOriginal(...x);
        };
        inst.addEventListener("result", (ev) => {
          try {
            const texto = Array.from(ev.results).map((r) => r[0] && r[0].transcript).join(" ").trim();
            if (texto) marca("STT_TEXT", { motor: nombre, texto: texto.slice(0, 80) });
          } catch (e) {
            /* ignore */
          }
        });
        inst.addEventListener("error", (ev) => marca("STT_ERROR", { motor: nombre, error: ev.error }));
        return inst;
      };
      Envuelto.prototype = Original.prototype;
      Object.defineProperty(w, nombre, { value: Envuelto, configurable: true, writable: true });
    }
  } catch (e) {
    /* ignore */
  }

  // ASSISTANT_REQUEST / ASSISTANT_RESPONSE
  try {
    const fetchOriginal = w.fetch.bind(w);
    w.fetch = async (recurso, opciones) => {
      const url = String(recurso && recurso.url ? recurso.url : recurso);
      const esAsistente = url.includes("/api/asistente/voice360");
      if (esAsistente) {
        let cuerpo = null;
        try {
          cuerpo = opciones && opciones.body ? JSON.parse(String(opciones.body)) : null;
        } catch (e) {
          /* ignore */
        }
        m.asistente.peticion = cuerpo ? String(cuerpo.input ?? cuerpo.confirm_token ?? "").slice(0, 120) : "";
        marca("ASSISTANT_REQUEST", { input: m.asistente.peticion });
      }
      const respuesta = await fetchOriginal(recurso, opciones);
      if (esAsistente || url.includes("/api/asistente/transcribe")) {
        try {
          const copia = await respuesta.clone().json();
          if (esAsistente) {
            m.asistente.http = respuesta.status;
            m.asistente.respuesta = copia && copia.answer ? String(copia.answer) : null;
            m.asistente.error = copia && copia.error ? String(copia.error) : null;
            marca("ASSISTANT_RESPONSE", { http: respuesta.status, answer: (m.asistente.respuesta ?? "").slice(0, 90) });
          } else {
            marca("STT_TEXT", { motor: "servidor", texto: String((copia && copia.text) ?? "").slice(0, 80), http: respuesta.status });
          }
        } catch (e) {
          /* ignore */
        }
      }
      return respuesta;
    };
  } catch (e) {
    /* ignore */
  }

  // TTS_REQUEST / PLAY_*
  try {
    if (w.speechSynthesis && typeof w.speechSynthesis.speak === "function") {
      const speakOriginal = w.speechSynthesis.speak.bind(w.speechSynthesis);
      // QUIÉN CORTA LA VOZ: si algo llama a cancel(), la locución NO termina con
      // `end` y el usuario oye la respuesta cortada. La traza dice desde dónde.
      const cancelOriginal = w.speechSynthesis.cancel.bind(w.speechSynthesis);
      w.speechSynthesis.cancel = () => {
        marca("TTS_CANCEL", {
          hablando: w.speechSynthesis.speaking,
          traza: String(new Error().stack || "").split("\n").slice(1, 5).join(" | ").slice(0, 400),
        });
        return cancelOriginal();
      };

      w.speechSynthesis.speak = (locucion) => {
        m.tts.peticiones += 1;
        const texto = locucion && locucion.text ? String(locucion.text) : "";
        m.play.ultimoTexto = texto.slice(0, 120);
        m.play.caracteres = texto.length;
        m.play.solicitadoEn = Date.now();
        marca("TTS_REQUEST", { caracteres: texto.length, voces: m.tts.voces });
        try {
          locucion.addEventListener("start", () => {
            m.play.started += 1;
            m.play.iniciadoEn = Date.now();
            marca("PLAY_STARTED", { msDesdePeticion: m.play.iniciadoEn - m.play.solicitadoEn });
          });
          locucion.addEventListener("end", () => {
            m.play.ended += 1;
            m.play.terminadoEn = Date.now();
            marca("PLAY_ENDED", { msDeAudio: m.play.terminadoEn - (m.play.iniciadoEn ?? m.play.terminadoEn) });
          });
          locucion.addEventListener("error", (ev) => {
            m.play.error += 1;
            m.play.ultimoError = ev && ev.error ? String(ev.error) : "desconocido";
            marca("PLAY_ERROR", { error: m.play.ultimoError });
          });
        } catch (e) {
          marca("PLAY_ERROR", { error: "no-se-pudieron-enganchar-eventos" });
        }
        marca("TTS_READY", { voces: m.tts.voces, lang: locucion && locucion.lang });
        return speakOriginal(locucion);
      };
    }
  } catch (e) {
    /* ignore */
  }

  // Cambios del cuadro de texto (STT → ENTENDER)
  try {
    document.addEventListener(
      "input",
      (ev) => {
        const t = ev.target;
        if (t && t.tagName === "TEXTAREA") {
          const valor = String(t.value || "").trim();
          if (valor) {
            m.sttTexto = valor;
            marca("STT_TEXT", { motor: "cuadro", texto: valor.slice(0, 80) });
          }
        }
      },
      true
    );
  } catch (e) {
    /* ignore */
  }
}

function utilidades() {
  const qa = {};
  qa.marcas = () => window.__qaMarcas;
  qa.botonDictar = () =>
    [...document.querySelectorAll("button")].find((b) => /^(Dictar|Detener|Transcribiendo…)$/.test((b.textContent || "").trim()));
  qa.etiquetaDictar = () => {
    const b = qa.botonDictar();
    return b ? (b.textContent || "").trim() : "SIN_BOTON";
  };
  qa.botonEnviar = () => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Enviar");
  qa.textarea = () => document.querySelector('textarea[placeholder^="Habla o escribe"]');
  qa.valor = () => (qa.textarea() ? qa.textarea().value : "");
  qa.limpiarTexto = () => {
    const ta = qa.textarea();
    if (!ta) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, "");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  };
  qa.ultimaRespuesta = () => {
    const nodos = [...document.querySelectorAll("div, p, li")].filter((n) => (n.textContent || "").length > 20);
    const ultimo = nodos.length ? nodos[nodos.length - 1].textContent.trim() : "";
    return ultimo.slice(0, 200);
  };
  qa.ruta = () => location.pathname + location.search;
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
}

async function pedirJson(url, ms = 5000) {
  const c = new AbortController();
  const reloj = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    return await r.json();
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
function finalizarPorTope() {
  console.error(`\n[E2E] TOPE GLOBAL AGOTADO (${TIMEOUT_TOTAL_MS} ms): se cierra y se mata Chrome.`);
  if (informeGlobal) console.error("[E2E] INFORME PARCIAL " + JSON.stringify(informeGlobal));
  matarChrome(chromeGlobal);
  process.exit(3);
}

async function principal() {
  if (!existsSync(CHROME)) throw new Error(`No se encuentra Chrome en ${CHROME}`);
  if (!existsSync(WAV)) throw new Error(`No existe el audio de prueba: ${WAV}`);

  const perfil = mkdtempSync(join(tmpdir(), "e360-e2e-"));
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
  const informe = { url: URL_BASE, ciclosPedidos: CICLOS, segundos: SEGUNDOS, modoForzado: SIN_WEBSPEECH ? "fallback" : "auto", ciclos: [] };
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
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source:
        `(${instrumentacion.toString()})();` +
        (SIN_WEBSPEECH
          ? "try{delete window.SpeechRecognition;delete window.webkitSpeechRecognition;Object.defineProperty(window,'SpeechRecognition',{value:undefined,configurable:true});Object.defineProperty(window,'webkitSpeechRecognition',{value:undefined,configurable:true});}catch(e){}"
          : ""),
    });

    // ── ABRIR (sin contraseña) ────────────────────────────────────────────────
    console.log(`ABRIR: ${URL_BASE}/asistente`);
    await cdp.send("Page.navigate", { url: `${URL_BASE}/asistente` });
    for (let i = 0; i < 80; i += 1) {
      const listo = await cdp.evaluar(
        `!!document.querySelector('textarea[placeholder^="Habla o escribe"]') && !location.pathname.startsWith('/login')`
      );
      if (listo) break;
      await dormir(500);
    }
    informe.abrioSinPassword = await cdp.evaluar(
      `!location.pathname.startsWith('/login') && !!document.querySelector('textarea[placeholder^="Habla o escribe"]')`
    );
    await cdp.evaluar(`(${utilidades.toString()})(); true;`);
    const sesion = await cdp.evaluar(`fetch('/api/auth/session').then(r=>r.json()).catch(()=>null)`);
    informe.usuarioSesion = sesion?.user?.email ?? null;
    console.log(`  abrió sin contraseña: ${informe.abrioSinPassword} · usuario=${informe.usuarioSesion ?? "?"}`);

    // HIDRATACIÓN: el botón existe en el HTML del servidor antes de que React le ate
    // su manejador; pulsar antes pierde el clic (no es un fallo del dictado).
    informe.paginaHidratada = false;
    for (let i = 0; i < 60; i += 1) {
      const h = await cdp.evaluar(
        `(() => { const ta = document.querySelector('textarea[placeholder^="Habla o escribe"]');
                  if (!ta) return false;
                  return Object.keys(ta).some(k => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$')); })()`
      );
      if (h) {
        informe.paginaHidratada = true;
        break;
      }
      await dormir(500);
    }
    // ENTORNO REAL DEL NAVEGADOR: es lo que decide qué motor puede usarse.
    informe.entorno = await cdp.evaluar(
      `({
         secure: window.isSecureContext,
         mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
         mediaRecorder: typeof window.MediaRecorder === 'function',
         webSpeech: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
         speechSynthesis: 'speechSynthesis' in window,
         voces: ('speechSynthesis' in window) ? window.speechSynthesis.getVoices().length : -1,
         ua: navigator.userAgent.slice(0, 60)
       })`
    );
    console.log(`  hidratada=${informe.paginaHidratada} · entorno=${JSON.stringify(informe.entorno)}`);

    /** ¿Sigue viva la misma carga de documento? (detecta recargas que borran el estado) */
    const sonda = async () =>
      await cdp.evaluar(
        `({ url: location.href, ready: document.readyState, origen: Math.round(performance.timeOrigin),
            qaApp: typeof window.__qaApp, qaMarcas: typeof window.__qaMarcas,
            react: (() => { const ta = document.querySelector('textarea[placeholder^="Habla o escribe"]');
                            return ta ? Object.keys(ta).some(k => k.startsWith('__react')) : false; })() })`
      );
    informe.sondaTrasInyeccion = await sonda();
    console.log(`  sonda tras inyectar: ${JSON.stringify(informe.sondaTrasInyeccion)}`);

    const esperarEtiqueta = async (objetivos, ms) => {
      const fin = Date.now() + ms;
      for (;;) {
        const e = await cdp.evaluar("window.__qaApp.etiquetaDictar()");
        if (objetivos.includes(e)) return e;
        if (Date.now() > fin) return null;
        await dormir(250);
      }
    };

    // ── 3 CONVERSACIONES CONSECUTIVAS, SIN RECARGAR ───────────────────────────
    for (let ciclo = 1; ciclo <= CICLOS; ciclo += 1) {
      const paso = { ciclo, marcas: [], texto: "", respuesta: "", faltas: [], resultado: "DESCONOCIDO" };
      const trabajo = (async () => {
        paso.sondaInicio = await sonda();
        if (paso.sondaInicio.qaApp !== "object") {
          // La inyección de utilidades se perdió (otra carga de documento): se
          // vuelve a inyectar para no medir un fallo que no es de la app.
          await cdp.evaluar(`(${utilidades.toString()})(); true;`);
          paso.reinyectado = true;
        }
        const marcasAntes = (await cdp.evaluar("window.__qaMarcas.marcas.length")) ?? 0;
        const playAntes = await cdp.evaluar("window.__qaMarcas.play");

        if (!informe.abrioSinPassword) {
          paso.faltas.push("ACCESO_SIN_PASSWORD");
          return;
        }

        // HABLAR
        const libre = await esperarEtiqueta(["Dictar"], 30000);
        if (libre !== "Dictar") {
          paso.faltas.push("BOTON_DICTAR_NO_LIBRE");
          return;
        }
        await cdp.evaluar("window.__qaApp.limpiarTexto()");
        const etiquetaAntes = await cdp.evaluar("window.__qaApp.etiquetaDictar()");
        await cdp.evaluar(`(() => { const b = window.__qaApp.botonDictar(); if (b) b.click(); return true; })()`);
        await dormir(1000);
        paso.etiquetaTrasPulsar = await cdp.evaluar("window.__qaApp.etiquetaDictar()");
        paso.avisoPantalla = await cdp.evaluar(
          `(() => { const n = document.querySelector('[role="alert"]'); return n ? n.textContent.trim().slice(0,160) : ''; })()`
        );
        paso.modoComponente = await cdp.evaluar("window.__qaApp.etiquetaDictar()");
        if (etiquetaAntes !== "Dictar") paso.faltas.push("BOTON_NO_ESTABA_LIBRE");
        const grabando = await esperarEtiqueta(["Detener"], 12000);
        if (grabando !== "Detener") {
          paso.faltas.push("NO_ARRANCA_ESCUCHA");
          paso.marcasHastaFallo = ((await cdp.evaluar("window.__qaMarcas.marcas")) ?? []).map((m) => m.nombre);
          paso.mic = (await cdp.evaluar("window.__qaMarcas.mic")) ?? 0;
          return;
        }
        await dormir(SEGUNDOS * 1000);
        await cdp.evaluar(`(() => { const b = window.__qaApp.botonDictar(); if (b) b.click(); return true; })()`);

        // ENTENDER: el texto debe llegar al cuadro.
        //
        // Si el proveedor de voz devuelve 429/503 (cuota/saturación), el aviso es
        // "No se pudo transcribir el audio" y NO es un fallo de la app: se registra
        // y se repite el turno, que es exactamente lo que haría el usuario.
        // `E360_REINTENTOS_PROVEEDOR` limita esos reintentos (por defecto 2).
        const maxReintentos = Number(process.env.E360_REINTENTOS_PROVEEDOR ?? 2);
        paso.reintentosPorProveedor = 0;
        const esperarTexto = async (ms) => {
          for (let i = 0; i < Math.ceil(ms / 500); i += 1) {
            paso.texto = (await cdp.evaluar("window.__qaApp.valor()")) ?? "";
            if (paso.texto.trim()) return true;
            await dormir(500);
          }
          return false;
        };
        const avisoActual = async () =>
          await cdp.evaluar(
            `(() => { const n = document.querySelector('[role="alert"]'); return n ? n.textContent.trim() : ''; })()`
          );

        let hayTexto = await esperarTexto(45000);
        while (!hayTexto && paso.reintentosPorProveedor < maxReintentos) {
          const aviso = await avisoActual();
          const esProveedor = /No se pudo transcribir el audio|no se ha oído nada/i.test(aviso);
          if (!esProveedor) break;
          paso.reintentosPorProveedor += 1;
          paso.avisosProveedor = [...(paso.avisosProveedor ?? []), aviso.slice(0, 100)];
          console.log(`   [proveedor] ${aviso.slice(0, 80)} → se repite el turno (${paso.reintentosPorProveedor}/${maxReintentos})`);
          await esperarEtiqueta(["Dictar"], 30000);
          await cdp.evaluar("window.__qaApp.limpiarTexto()");
          await cdp.evaluar(`(() => { const b = window.__qaApp.botonDictar(); if (b) b.click(); return true; })()`);
          if ((await esperarEtiqueta(["Detener"], 12000)) !== "Detener") break;
          await dormir(SEGUNDOS * 1000);
          await cdp.evaluar(`(() => { const b = window.__qaApp.botonDictar(); if (b) b.click(); return true; })()`);
          hayTexto = await esperarTexto(45000);
        }
        if (!hayTexto) {
          paso.faltas.push("STT_TEXT");
          paso.marcasHastaFallo = ((await cdp.evaluar("window.__qaMarcas.marcas")) ?? []).map((m) => m.nombre);
          return;
        }

        // RESPONDER: pulsar Enviar (es el gesto que usa el usuario en el móvil)
        await esperarEtiqueta(["Dictar"], 30000);
        const hayEnviar = await cdp.evaluar("!!window.__qaApp.botonEnviar()");
        if (!hayEnviar) {
          paso.faltas.push("SIN_BOTON_ENVIAR");
          return;
        }
        await cdp.evaluar(`(() => { const b = window.__qaApp.botonEnviar(); if (b) b.click(); return true; })()`);

        for (let i = 0; i < 120; i += 1) {
          const asis = await cdp.evaluar("window.__qaMarcas.asistente");
          if (asis && asis.respuesta) {
            paso.respuesta = asis.respuesta;
            paso.httpAsistente = asis.http;
            break;
          }
          if (asis && asis.error) {
            paso.errorAsistente = asis.error;
            break;
          }
          await dormir(500);
        }
        if (!paso.respuesta) {
          paso.faltas.push("ASSISTANT_RESPONSE");
          return;
        }

        // OÍR: marcadores de TTS/altavoz. La respuesta puede ser larga: se espera
        // al FIN de la locución con un tope generoso pero ACOTADO.
        const esperaAudioMs = Number(process.env.E360_ESPERA_AUDIO_MS ?? 90000);
        const finAudio = Date.now() + esperaAudioMs;
        for (;;) {
          const play = await cdp.evaluar("window.__qaMarcas.play");
          const ttsEstado = await cdp.evaluar(
            `({ hablando: window.speechSynthesis.speaking, pendiente: window.speechSynthesis.pending })`
          );
          if (play && play.ended > (playAntes?.ended ?? 0)) break;
          if (play && play.error > (playAntes?.error ?? 0)) break;
          if (Date.now() > finAudio) {
            paso.audioAgotado = { play, ttsEstado, msEsperados: esperaAudioMs };
            break;
          }
          await dormir(500);
        }
        const marcas = await cdp.evaluar("window.__qaMarcas.marcas");
        paso.marcas = (marcas ?? []).slice(marcasAntes).map((m) => m.nombre);
        const tts = await cdp.evaluar("window.__qaMarcas.tts");
        const play = await cdp.evaluar("window.__qaMarcas.play");
        paso.tts = { voces: tts?.voces ?? -1, peticiones: tts?.peticiones ?? 0, disponible: tts?.disponible ?? false };
        paso.play = {
          started: play?.started ?? 0,
          ended: play?.ended ?? 0,
          error: play?.error ?? 0,
          ultimoError: play?.ultimoError ?? null,
        };

        if (!paso.marcas.includes("TTS_REQUEST")) paso.faltas.push("TTS_REQUEST");
        if (!paso.marcas.includes("PLAY_STARTED")) paso.faltas.push("PLAY_STARTED");
        if (paso.play.ended <= (playAntes?.ended ?? 0)) paso.faltas.push("PLAY_ENDED");
      })();

      try {
        await conTope(trabajo, TIMEOUT_CICLO_MS, `ciclo${ciclo}`);
      } catch (e) {
        paso.faltas.push(String(e.message ?? e).startsWith("TOPE") ? "TIMEOUT_CICLO" : "EXCEPCION");
        paso.errorCiclo = String(e.message ?? e);
      }
      paso.resultado = paso.faltas.length === 0 ? "OK" : `FALTA:${paso.faltas.join("+")}`;
      informe.ciclos.push(paso);
      informeGlobal = informe;
      console.log(`CICLO ${ciclo}/${CICLOS}: ${paso.resultado} · sonda=${JSON.stringify(paso.sondaInicio ?? null)}${paso.reinyectado ? " (REINYECTADO)" : ""}`);
      if (paso.texto) console.log(`   STT_TEXT: "${paso.texto.slice(0, 100)}"`);
      if (paso.respuesta) console.log(`   ASSISTANT_RESPONSE (http ${paso.httpAsistente}): "${paso.respuesta.slice(0, 100)}"`);
      if (paso.tts) console.log(`   TTS: voces=${paso.tts.voces} peticiones=${paso.tts.peticiones} · PLAY started=${paso.play?.started} ended=${paso.play?.ended} error=${paso.play?.error}${paso.play?.ultimoError ? ` (${paso.play.ultimoError})` : ""}`);
      if (paso.faltas.length) console.log(`   PRIMER FALLO: ${paso.faltas[0]}`);
      if (paso.etiquetaTrasPulsar !== undefined) {
        console.log(`   tras pulsar: botón="${paso.etiquetaTrasPulsar}" · aviso="${paso.avisoPantalla ?? ""}" · mic=${paso.mic ?? "-"} · marcas=${(paso.marcasHastaFallo ?? []).join(",") || "-"}`);
      }
    }

    informe.logsVoz = cdp.consola.slice(-40);
    informe.veredicto = {
      abrioSinPassword: informe.abrioSinPassword,
      ciclos: informe.ciclos.length,
      ciclosOK: informe.ciclos.filter((c) => c.resultado === "OK").length,
      primerFallo: informe.ciclos.find((c) => c.faltas.length)?.faltas[0] ?? null,
      PASS: informe.ciclos.length === CICLOS && informe.ciclos.every((c) => c.resultado === "OK"),
    };
  } finally {
    matarChrome(chrome);
  }

  console.log("\n=== VEREDICTO ===");
  console.log(JSON.stringify(informe.veredicto, null, 1));
  console.log("INFORME_JSON " + JSON.stringify(informe));
  process.exit(informe.veredicto?.PASS ? 0 : 2);
}

setTimeout(finalizarPorTope, TIMEOUT_TOTAL_MS);
principal().catch((e) => {
  console.error("FALLO:", e.message);
  matarChrome(chromeGlobal);
  if (informeGlobal) console.error("INFORME_PARCIAL " + JSON.stringify(informeGlobal));
  process.exit(1);
});
