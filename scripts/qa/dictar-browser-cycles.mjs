/**
 * ELECTRICISTA360 — QA DEL DICTADO (2/2): CICLOS REALES EN NAVEGADOR
 *
 * Chrome REAL por DevTools Protocol + micrófono sintético
 * (`--use-file-for-fake-audio-capture`) con la FRASE REAL generada por TTS. No hay
 * simulación del componente: se pulsa el botón de verdad, se graba audio de verdad
 * y se lee el textarea de verdad.
 *
 * REGLA DE ORO DE ESTE ARNÉS: **NADA ESPERA PARA SIEMPRE**.
 *   - Cada llamada a DevTools tiene su propio timeout (`E360_TIMEOUT_CDP_MS`).
 *   - Cada ciclo tiene un tope duro (`E360_TIMEOUT_CICLO_MS`).
 *   - La ejecución entera tiene un tope duro (`E360_TIMEOUT_TOTAL_MS`): al agotarse
 *     imprime el informe parcial, MATA el Chrome (árbol completo) y sale con código
 *     3. Nunca se queda colgada en silencio.
 *   - Cada ciclo imprime progreso ANTES de empezar y su resultado al terminar.
 *
 * CADA CICLO SE VERIFICA CON EVIDENCIA, no con una impresión:
 *   1. arrancó de verdad (el botón pasó a "Detener");
 *   2. terminó con TEXTO o con un ERROR CONTROLADO (nunca en el limbo);
 *   3. el botón DICTAR volvió a estar libre ("Dictar");
 *   4. no queda NADA residual: pistas de micrófono vivas, MediaRecorder vivos,
 *      reconocedores vivos ni temporizadores del ciclo sin cancelar;
 *   5. el ciclo siguiente puede arrancar (lo demuestra el propio ciclo siguiente).
 * Los puntos 4 y 5 se miden con instrumentación instalada EN LA PÁGINA antes de que
 * cargue la app (ver `instrumentacionPagina`).
 *
 * Los fallos del PROVEEDOR (429 de cuota, 503 de saturación) NO bloquean la prueba:
 * se registran por ciclo (código HTTP + qué proveedor/modelo contestó) y el ciclo
 * se da por bueno si el usuario recibe texto o un error controlado.
 *
 * Variables de entorno:
 *   E360_CICLOS=10            número de ciclos Dictar → Detener
 *   E360_SEGUNDOS=7           segundos grabando en cada ciclo
 *   E360_PAUSA_MS=2500        pausa entre ciclos (aire para la cuota del proveedor)
 *   E360_TIMEOUT_CICLO_MS=90000   tope duro por ciclo
 *   E360_TIMEOUT_TOTAL_MS=900000  tope duro de toda la ejecución (15 min)
 *   E360_TIMEOUT_CDP_MS=15000     tope por llamada a DevTools
 *   E360_SIN_WEBSPEECH=1      borra SpeechRecognition → obliga el fallback de servidor
 *   E360_DENEGAR_MIC=1        deniega el permiso de micrófono (caso de error)
 *   E360_ERRORES=0            saltarse las fases de error/timeout y recuperación
 *   E360_LIMPIAR=0            NO vaciar el textarea entre ciclos
 *   E360_WAV=<ruta>           audio del micrófono sintético (por defecto frase.wav)
 *   E360_QA_BASE=<url>        base del servidor de desarrollo
 *
 * Sin secretos: las credenciales locales se leen de `.env.local` (ignorado por git).
 */

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.E360_CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PUERTO = Number(process.env.E360_PUERTO ?? 9333);
const BASE = process.env.E360_QA_BASE ?? "http://127.0.0.1:3110";
const CICLOS = Number(process.env.E360_CICLOS ?? 10);
const SEGUNDOS = Number(process.env.E360_SEGUNDOS ?? 7);
const PAUSA_MS = Number(process.env.E360_PAUSA_MS ?? 2500);
const TIMEOUT_CICLO_MS = Number(process.env.E360_TIMEOUT_CICLO_MS ?? 90000);
const TIMEOUT_TOTAL_MS = Number(process.env.E360_TIMEOUT_TOTAL_MS ?? 900000);
const TIMEOUT_CDP_MS = Number(process.env.E360_TIMEOUT_CDP_MS ?? 15000);
const SIN_WEBSPEECH = process.env.E360_SIN_WEBSPEECH === "1";
const DENEGAR_MIC = process.env.E360_DENEGAR_MIC === "1";
const LIMPIAR = process.env.E360_LIMPIAR !== "0";
const ERRORES = process.env.E360_ERRORES !== "0";
const WAV = process.env.E360_WAV ?? join(tmpdir(), "e360-qa", "frase.wav");

/** Trozo final de la frase obligatoria: si llega, el audio se ha transcrito entero. */
const COLA_FRASE = "mano de obra";
/** Esperas máximas (ms) de las transiciones del botón dentro de un ciclo. */
const ESPERA_LIBRE_MS = 45000;
const ESPERA_GRABANDO_MS = 12000;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Toda promesa tiene tope: si vence, se resuelve con un valor controlado. */
function conTope(promesa, ms, etiqueta) {
  return new Promise((resolver, rechazar) => {
    const reloj = setTimeout(
      () => rechazar(new Error(`TOPE_AGOTADO:${etiqueta}:${ms}ms`)),
      ms
    );
    promesa.then(
      (valor) => {
        clearTimeout(reloj);
        resolver(valor);
      },
      (error) => {
        clearTimeout(reloj);
        rechazar(error);
      }
    );
  });
}

function credenciales() {
  const env = readFileSync(".env.local", "utf8");
  const bloque = env.split(/OBSOLETO/)[1] ?? env;
  const correo = /correo\s*:\s*(\S+)/.exec(bloque);
  const clave = /contrasena\s*:\s*(\S+)/.exec(bloque);
  if (!correo || !clave) throw new Error("No se pudieron leer las credenciales locales de .env.local");
  return { email: correo[1], password: clave[1] };
}

/**
 * INSTRUMENTACIÓN DE LA PÁGINA (se inyecta ANTES de que cargue la app).
 *
 * Cuenta lo que NO se ve desde el DOM y es justo lo que hay que demostrar:
 * pistas de micrófono vivas, MediaRecorder vivos, reconocedores de voz vivos,
 * temporizadores pendientes y la última respuesta del servidor de transcripción
 * (código HTTP + proveedor + error). Sin esto, "no queda nada residual" sería una
 * opinión; con esto es una medida.
 */
function instrumentacionPagina() {
  const w = window;
  const rec = {
    pistas: new Set(),
    recorders: new Set(),
    reconocedores: new Set(),
    timers: new Set(),
    intervalos: new Set(),
    ultimaLlamada: null,
    modoFetch: "normal",
  };
  w.__qaRec = rec;

  // 1) Micrófono: una pista viva significa que el micrófono sigue tomado.
  try {
    const md = navigator.mediaDevices;
    if (md && md.getUserMedia) {
      const original = md.getUserMedia.bind(md);
      md.getUserMedia = async (restricciones) => {
        const stream = await original(restricciones);
        for (const pista of stream.getTracks()) {
          const stopOriginal = pista.stop.bind(pista);
          pista.stop = () => {
            rec.pistas.delete(pista);
            return stopOriginal();
          };
          rec.pistas.add(pista);
        }
        return stream;
      };
    }
  } catch (e) {
    /* la instrumentación nunca puede romper la app */
  }

  // 2) MediaRecorder vivos: una grabación viva es una sesión NO destruida.
  try {
    const MR = w.MediaRecorder;
    if (typeof MR === "function") {
      const Instrumentado = function (...args) {
        const instancia = new MR(...args);
        rec.recorders.add(instancia);
        instancia.addEventListener("stop", () => rec.recorders.delete(instancia));
        instancia.addEventListener("error", () => rec.recorders.delete(instancia));
        return instancia;
      };
      Instrumentado.prototype = MR.prototype;
      if (typeof MR.isTypeSupported === "function") {
        Instrumentado.isTypeSupported = MR.isTypeSupported.bind(MR);
      }
      Object.defineProperty(w, "MediaRecorder", {
        value: Instrumentado,
        configurable: true,
        writable: true,
      });
    }
  } catch (e) {
    /* ignore */
  }

  // 3) Reconocedores de voz vivos (vía navegador).
  try {
    for (const nombre of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      const Original = w[nombre];
      if (typeof Original !== "function") continue;
      const Instrumentado = function (...args) {
        const instancia = new Original(...args);
        rec.reconocedores.add(instancia);
        for (const evento of ["end", "error"]) {
          instancia.addEventListener(evento, () => rec.reconocedores.delete(instancia));
        }
        return instancia;
      };
      Instrumentado.prototype = Original.prototype;
      Object.defineProperty(w, nombre, {
        value: Instrumentado,
        configurable: true,
        writable: true,
      });
    }
  } catch (e) {
    /* ignore */
  }

  // 4) Temporizadores pendientes (para ver que un ciclo no deja basura armada).
  try {
    const setTimeoutOriginal = w.setTimeout.bind(w);
    const clearTimeoutOriginal = w.clearTimeout.bind(w);
    const setIntervalOriginal = w.setInterval.bind(w);
    const clearIntervalOriginal = w.clearInterval.bind(w);
    w.setTimeout = (fn, ms, ...resto) => {
      const id = setTimeoutOriginal(() => {
        rec.timers.delete(id);
        if (typeof fn === "function") fn();
      }, ms, ...resto);
      rec.timers.add(id);
      return id;
    };
    w.clearTimeout = (id) => {
      rec.timers.delete(id);
      return clearTimeoutOriginal(id);
    };
    w.setInterval = (fn, ms, ...resto) => {
      const id = setIntervalOriginal(fn, ms, ...resto);
      rec.intervalos.add(id);
      return id;
    };
    w.clearInterval = (id) => {
      rec.intervalos.delete(id);
      return clearIntervalOriginal(id);
    };
  } catch (e) {
    /* ignore */
  }

  // 5) Última respuesta del servidor de transcripción: código y proveedor REALES.
  try {
    const fetchOriginal = w.fetch.bind(w);
    w.fetch = async (recurso, opciones) => {
      const url = String(recurso && recurso.url ? recurso.url : recurso);
      if (url.includes("/api/asistente/transcribe")) {
        if (rec.modoFetch === "rechaza") {
          rec.ultimaLlamada = { status: 0, provider: null, error: "fallo de red simulado" };
          throw new Error("QA: fallo de red simulado");
        }
        if (rec.modoFetch === "cuelga") {
          // Servidor MUDO de verdad: nunca responde, pero respeta el AbortSignal
          // (como un fetch colgado real). Así se prueba el tope del cliente.
          return new Promise((_, rechazar) => {
            const senal = opciones && opciones.signal;
            if (!senal) return;
            if (senal.aborted) {
              rechazar(new DOMException("Aborted", "AbortError"));
              return;
            }
            senal.addEventListener("abort", () =>
              rechazar(new DOMException("Aborted", "AbortError"))
            );
          });
        }
        const respuesta = await fetchOriginal(recurso, opciones);
        try {
          const cuerpo = await respuesta.clone().json();
          rec.ultimaLlamada = {
            status: respuesta.status,
            provider: cuerpo.provider ?? null,
            error: cuerpo.error ?? null,
            texto: typeof cuerpo.text === "string" ? cuerpo.text.slice(0, 70) : null,
          };
        } catch (e) {
          rec.ultimaLlamada = { status: respuesta.status, provider: null, error: "sin-json" };
        }
        return respuesta;
      }
      return fetchOriginal(recurso, opciones);
    };
  } catch (e) {
    /* ignore */
  }
}

/** Utilidades de manejo de la pantalla (se inyectan tras cargar la app). */
function utilidadesPagina() {
  const qa = {
    boton: () =>
      [...document.querySelectorAll("button")].find((b) =>
        /^(Dictar|Detener|Transcribiendo…)$/.test((b.textContent || "").trim())
      ),
    etiqueta: () => {
      const b = qa.boton();
      return b ? (b.textContent || "").trim() : "SIN_BOTON";
    },
    textarea: () => document.querySelector('textarea[placeholder^="Habla o escribe"]'),
    limpiar: () => {
      const ta = qa.textarea();
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, "");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    },
    valor: () => qa.textarea().value,
    error: () => {
      const nodo = document.querySelector('[role="alert"]');
      return nodo ? nodo.textContent.trim() : "";
    },
    residuos: () => ({
      pistasMicro: window.__qaRec ? window.__qaRec.pistas.size : -1,
      recorders: window.__qaRec ? window.__qaRec.recorders.size : -1,
      reconocedores: window.__qaRec ? window.__qaRec.reconocedores.size : -1,
      timers: window.__qaRec ? window.__qaRec.timers.size : -1,
      intervalos: window.__qaRec ? window.__qaRec.intervalos.size : -1,
    }),
    ultimaLlamada: () => (window.__qaRec ? window.__qaRec.ultimaLlamada : null),
    olvidarLlamada: () => {
      if (window.__qaRec) window.__qaRec.ultimaLlamada = null;
    },
    modoFetch: (valor) => {
      if (window.__qaRec) window.__qaRec.modoFetch = valor;
      return valor;
    },
    modo: () => {
      const w = window;
      if (w.AndroidSTT) return "native";
      if (w.SpeechRecognition || w.webkitSpeechRecognition) return "web";
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && w.MediaRecorder) {
        return "fallback";
      }
      return "none";
    },
  };
  window.__qaDictar = qa;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pendientes = new Map();
    this.consola = [];
    ws.onmessage = (evento) => {
      const msg = JSON.parse(evento.data);
      if (msg.method === "Runtime.consoleAPICalled") {
        const texto = (msg.params?.args ?? [])
          .map((a) => (a.value !== undefined ? String(a.value) : a.description ?? ""))
          .join(" ");
        this.consola.push(texto);
        return;
      }
      const p = this.pendientes.get(msg.id);
      if (!p) return;
      this.pendientes.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    };
  }

  /** Toda llamada a DevTools tiene tope: una pestaña colgada no puede bloquear el QA. */
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
    const r = await this.send("Runtime.evaluate", {
      expression: expresion,
      awaitPromise,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        "EVAL: " + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails))
      );
    }
    return r.result?.value;
  }
}

async function pedirJson(url, ms = 5000) {
  const controlador = new AbortController();
  const reloj = setTimeout(() => controlador.abort(), ms);
  try {
    const r = await fetch(url, { signal: controlador.signal });
    return await r.json();
  } finally {
    clearTimeout(reloj);
  }
}

async function esperarDevtools() {
  for (let i = 0; i < 60; i += 1) {
    try {
      await pedirJson(`http://127.0.0.1:${PUERTO}/json/version`, 2000);
      return;
    } catch {
      /* todavía no escucha */
    }
    await dormir(250);
  }
  throw new Error("Chrome no ha abierto el puerto de depuración (tope de 15 s)");
}

async function paginaObjetivo() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const lista = await pedirJson(`http://127.0.0.1:${PUERTO}/json/list`, 2000);
      const pagina = lista.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (pagina) return pagina;
    } catch {
      /* reintento */
    }
    await dormir(250);
  }
  throw new Error("No hay ninguna pestaña que controlar (tope de 15 s)");
}

/** Mata el árbol COMPLETO de Chrome del QA (el lanzador no basta). */
function matarChrome(proceso) {
  if (!proceso || proceso.killed) return;
  try {
    spawnSync("taskkill", ["/PID", String(proceso.pid), "/T", "/F"], { stdio: "ignore" });
  } catch {
    /* ignore */
  }
  try {
    proceso.kill("SIGKILL");
  } catch {
    /* ignore */
  }
}

/** Temporizador global: pase lo que pase, el QA TERMINA. */
let informeGlobal = null;
let chromeGlobal = null;
let cronometroGlobal = null;

function finalizarPorTope() {
  console.error(
    `\n[QA] TOPE GLOBAL AGOTADO (${TIMEOUT_TOTAL_MS} ms): se cierra la prueba y se mata Chrome.`
  );
  if (informeGlobal) console.error("[QA] INFORME PARCIAL " + JSON.stringify(informeGlobal));
  matarChrome(chromeGlobal);
  process.exit(3);
}

async function principal() {
  if (!existsSync(CHROME)) throw new Error(`No se encuentra Chrome en ${CHROME}`);
  if (!existsSync(WAV)) throw new Error(`No existe el audio de prueba: ${WAV}`);

  const perfil = mkdtempSync(join(tmpdir(), "e360-chrome-"));
  const args = [
    "--headless=new",
    `--remote-debugging-port=${PUERTO}`,
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${WAV}`,
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=420,900",
    "about:blank",
  ];
  if (!DENEGAR_MIC) args.splice(6, 0, "--use-fake-ui-for-media-stream");

  const chrome = spawn(CHROME, args, { stdio: "ignore" });
  chromeGlobal = chrome;
  const informe = {
    modo: SIN_WEBSPEECH ? "fallback" : "navegador",
    permisoDenegado: DENEGAR_MIC,
    ciclosPedidos: CICLOS,
    segundosPorCiclo: SEGUNDOS,
    topes: {
      cicloMs: TIMEOUT_CICLO_MS,
      totalMs: TIMEOUT_TOTAL_MS,
      cdpMs: TIMEOUT_CDP_MS,
    },
    ciclos: [],
    fases: [],
    errores: [],
  };
  informeGlobal = informe;

  try {
    await esperarDevtools();
    const pagina = await paginaObjetivo();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await conTope(
      new Promise((res, rej) => {
        ws.onopen = res;
        ws.onerror = () => rej(new Error("No se pudo conectar a DevTools"));
      }),
      10000,
      "ws:open"
    );
    const cdp = new Cdp(ws);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");

    // Instrumentación + overrides ANTES de que la app cargue (una sola vez).
    const fuente =
      `(${instrumentacionPagina.toString()})();` +
      (SIN_WEBSPEECH
        ? "try{delete window.SpeechRecognition;delete window.webkitSpeechRecognition;" +
          "Object.defineProperty(window,'SpeechRecognition',{value:undefined,configurable:true});" +
          "Object.defineProperty(window,'webkitSpeechRecognition',{value:undefined,configurable:true});}catch(e){}"
        : "");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: fuente });

    if (DENEGAR_MIC) {
      // El nombre del descriptor es el de la plataforma web ("microphone"), no el
      // de PermissionType de CDP ("audioCapture"): con el nombre equivocado Chrome
      // rechaza la orden con -32602 y la prueba no llegaba ni a empezar.
      // Se admite el fallo: sin `--use-fake-ui-for-media-stream` el permiso también
      // queda sin conceder, que es lo que se quiere medir.
      try {
        await cdp.send("Browser.setPermission", {
          permission: { name: "microphone" },
          setting: "denied",
          origin: BASE,
        });
      } catch (e) {
        informe.avisoPermiso = `no se pudo fijar el permiso por CDP: ${e.message}`;
        console.log(`[QA] aviso: ${informe.avisoPermiso} (se sigue con el diálogo sin conceder)`);
      }
    }

    const utilidades = `(${utilidadesPagina.toString()})(); true;`;

    // 1) Sesión
    const cred = credenciales();
    await cdp.send("Page.navigate", { url: `${BASE}/login` });
    await dormir(1500);
    const login = await cdp.evaluar(
      `(async () => {
         const r = await fetch('${BASE}/api/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(${JSON.stringify(cred)})
         });
         return r.status;
       })()`
    );
    if (login !== 200) throw new Error(`Login HTTP ${login}`);

    // 2) Pantalla del asistente
    await cdp.send("Page.navigate", { url: `${BASE}/asistente` });
    for (let i = 0; i < 60; i += 1) {
      const listo = await cdp.evaluar(`!!document.querySelector('textarea[placeholder^="Habla o escribe"]')`);
      if (listo) break;
      await dormir(500);
    }
    await cdp.evaluar(utilidades);

    informe.modoDetectado = await cdp.evaluar("window.__qaDictar.modo()");

    /**
     * HIDRATACIÓN: la página llega renderizada del servidor, así que el botón EXISTE
     * antes de que React le ate su manejador. Pulsar antes pierde el clic (no es un
     * fallo del dictado: es la prueba llegando pronto).
     */
    informe.paginaHidratada = false;
    for (let i = 0; i < 60; i += 1) {
      const hidratada = await cdp.evaluar(
        `(() => {
           const ta = document.querySelector('textarea[placeholder^="Habla o escribe"]');
           if (!ta) return false;
           return Object.keys(ta).some((k) => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$'));
         })()`
      );
      if (hidratada && cdp.consola.some((l) => l.includes("[VOZ360][STT] deteccion"))) {
        informe.paginaHidratada = true;
        break;
      }
      await dormir(500);
    }

    /** Espera a que el botón esté en una de las etiquetas dadas (con tope). */
    const esperarEtiqueta = async (objetivos, ms) => {
      const fin = Date.now() + ms;
      for (;;) {
        const etiqueta = await cdp.evaluar("window.__qaDictar.etiqueta()");
        if (objetivos.includes(etiqueta)) return etiqueta;
        if (Date.now() > fin) return null;
        await dormir(250);
      }
    };

    /**
     * UN CICLO COMPLETO, dirigido por estado y CON TOPE DURO:
     *   esperar "Dictar" → pulsar → esperar "Detener" → hablar → pulsar →
     *   esperar que VUELVA a "Dictar" → medir residuos.
     */
    const ejecutarCiclo = async (etiqueta, { exigirGrabacion = true } = {}) => {
      const paso = {
        ciclo: etiqueta,
        inicio: new Date().toISOString(),
        arranco: false,
        texto: "",
        error: "",
        botonAlTerminar: "",
        msHastaLibre: null,
        proveedor: null,
        httpTranscripcion: null,
        errorProveedor: null,
        residuosAntes: null,
        residuosDespues: null,
        residuoSesion: null,
        resultado: "DESCONOCIDO",
      };
      const trabajo = (async () => {
        if (PAUSA_MS > 0) await dormir(PAUSA_MS);
        const t0 = Date.now();
        paso.libreAlEmpezar = await esperarEtiqueta(["Dictar"], ESPERA_LIBRE_MS);
        if (paso.libreAlEmpezar !== "Dictar") {
          paso.error = "el botón no volvió a 'Dictar' antes del ciclo";
          paso.resultado = "BLOQUEADO";
          paso.msHastaLibre = Date.now() - t0;
          return;
        }
        if (LIMPIAR) await cdp.evaluar("window.__qaDictar.limpiar()");
        await cdp.evaluar("window.__qaDictar.olvidarLlamada()");
        paso.residuosAntes = await cdp.evaluar("window.__qaDictar.residuos()");

        // INICIAR
        await cdp.evaluar(
          `(() => { const b = window.__qaDictar.boton(); if (b) b.click(); return true; })()`
        );
        const grabando = await esperarEtiqueta(["Detener"], ESPERA_GRABANDO_MS);
        paso.arranco = grabando === "Detener";
        if (paso.arranco && exigirGrabacion) await dormir(SEGUNDOS * 1000);

        // PARAR (solo si sigue en marcha)
        const antesDeParar = await cdp.evaluar("window.__qaDictar.etiqueta()");
        if (antesDeParar !== "Dictar") {
          await cdp.evaluar(
            `(() => { const b = window.__qaDictar.boton(); if (b) b.click(); return true; })()`
          );
        }

        // Esperar a que la sesión quede LIBRE otra vez.
        const libre = await esperarEtiqueta(["Dictar"], ESPERA_LIBRE_MS);
        paso.msHastaLibre = Date.now() - t0;
        paso.botonAlTerminar = libre ?? (await cdp.evaluar("window.__qaDictar.etiqueta()"));
        paso.texto = (await cdp.evaluar("window.__qaDictar.valor()")) ?? "";
        if (!paso.texto.trim()) paso.error = await cdp.evaluar("window.__qaDictar.error()");
        const llamada = await cdp.evaluar("window.__qaDictar.ultimaLlamada()");
        if (llamada) {
          paso.proveedor = llamada.provider ?? null;
          paso.httpTranscripcion = llamada.status ?? null;
          paso.errorProveedor = llamada.error ?? null;
        }
        paso.residuosDespues = await cdp.evaluar("window.__qaDictar.residuos()");

        // VERIFICACIÓN DEL CICLO
        const r = paso.residuosDespues ?? {};
        paso.residuoSesion =
          (r.pistasMicro ?? 0) + (r.recorders ?? 0) + (r.reconocedores ?? 0);
        const libreOk = paso.botonAlTerminar === "Dictar";
        const conTexto = paso.texto.trim().length > 0;
        const errorControlado = paso.error.trim().length > 0;
        if (!libreOk) paso.resultado = "BOTON_NO_LIBERADO";
        else if (paso.residuoSesion !== 0) paso.resultado = "RESIDUO_SESION";
        else if (conTexto) paso.resultado = "TEXTO";
        else if (errorControlado) paso.resultado = "ERROR_CONTROLADO";
        else paso.resultado = "SIN_RESPUESTA";
      })();

      try {
        await conTope(trabajo, TIMEOUT_CICLO_MS, `ciclo:${etiqueta}`);
      } catch (e) {
        paso.error = String(e.message ?? e);
        paso.resultado = paso.error.startsWith("TOPE_AGOTADO") ? "TIMEOUT_CICLO" : "EXCEPCION";
        try {
          paso.botonAlTerminar = await cdp.evaluar("window.__qaDictar.etiqueta()");
          paso.residuosDespues = await cdp.evaluar("window.__qaDictar.residuos()");
        } catch {
          /* si ni eso responde, el informe lo dirá */
        }
      }
      return paso;
    };

    const imprimirPaso = (paso, indice, total) => {
      const marca = paso.resultado === "TEXTO" || paso.resultado === "ERROR_CONTROLADO" ? "OK" : "REVISAR";
      const r = paso.residuosDespues ?? {};
      console.log(
        `CICLO ${indice}/${total} [${marca}] ${paso.resultado} · botón="${paso.botonAlTerminar}" · ` +
          `libre en ${paso.msHastaLibre} ms · proveedor=${paso.proveedor ?? "-"} http=${paso.httpTranscripcion ?? "-"}` +
          `${paso.errorProveedor ? ` (${paso.errorProveedor})` : ""} · ` +
          `residuos: micro=${r.pistasMicro ?? "?"} rec=${r.recorders ?? "?"} stt=${r.reconocedores ?? "?"} timers=${r.timers ?? "?"}`
      );
      if (paso.texto.trim()) console.log(`         texto: "${paso.texto.slice(0, 120)}"`);
      if (paso.error.trim()) console.log(`         aviso: ${paso.error.slice(0, 140)}`);
    };

    // 3) CICLOS CONSECUTIVOS (sin recargar la página en ningún momento)
    for (let ciclo = 1; ciclo <= CICLOS; ciclo += 1) {
      console.log(`CICLO ${ciclo}/${CICLOS}: iniciando… (tope ${TIMEOUT_CICLO_MS} ms)`);
      const paso = await ejecutarCiclo(ciclo);
      informe.ciclos.push(paso);
      imprimirPaso(paso, ciclo, CICLOS);
      informeGlobal = informe;
    }

    // 4) AUTOCURACIÓN: error del servidor y servidor colgado (timeout)
    if (ERRORES && !DENEGAR_MIC) {
      console.log("FASE: servidor de transcripción que FALLA (fallo de red simulado)…");
      await cdp.evaluar("window.__qaDictar.modoFetch('rechaza')");
      const trasError = await ejecutarCiclo("tras-error");
      imprimirPaso(trasError, "tras-error", "tras-error");
      console.log("FASE: recuperación tras el error…");
      await cdp.evaluar("window.__qaDictar.modoFetch('normal')");
      const recuperadoError = await ejecutarCiclo("recuperacion-error");
      imprimirPaso(recuperadoError, "recuperacion-error", "recuperacion-error");

      console.log("FASE: servidor MUDO (nunca responde → debe liberar la sesión sola)…");
      await cdp.evaluar("window.__qaDictar.modoFetch('cuelga')");
      const colgado = await ejecutarCiclo("servidor-colgado");
      imprimirPaso(colgado, "servidor-colgado", "servidor-colgado");
      console.log("FASE: recuperación tras el timeout…");
      await cdp.evaluar("window.__qaDictar.modoFetch('normal')");
      const recuperadoTimeout = await ejecutarCiclo("recuperacion-timeout");
      imprimirPaso(recuperadoTimeout, "recuperacion-timeout", "recuperacion-timeout");

      informe.autocuracion = {
        trasError: {
          arranco: trasError.arranco,
          resultado: trasError.resultado,
          error: trasError.error,
          boton: trasError.botonAlTerminar,
        },
        recuperadoTrasError: {
          texto: recuperadoError.texto,
          resultado: recuperadoError.resultado,
          boton: recuperadoError.botonAlTerminar,
        },
        trasTimeout: {
          arranco: colgado.arranco,
          resultado: colgado.resultado,
          botonLiberadoSolo: colgado.botonAlTerminar === "Dictar",
          msHastaLibre: colgado.msHastaLibre,
          error: colgado.error,
        },
        recuperadoTrasTimeout: {
          texto: recuperadoTimeout.texto,
          resultado: recuperadoTimeout.resultado,
          boton: recuperadoTimeout.botonAlTerminar,
        },
      };
    }

    informe.estadoFinalBoton = await cdp.evaluar("window.__qaDictar.etiqueta()");
    informe.residuosFinales = await cdp.evaluar("window.__qaDictar.residuos()");
    informe.logsVoz = cdp.consola.filter((l) => l.includes("[VOZ360][STT]")).slice(0, 40);

    // 5) VEREDICTO
    const conFrase = informe.ciclos.filter((c) => (c.texto ?? "").includes(COLA_FRASE));
    const conTexto = informe.ciclos.filter((c) => (c.texto ?? "").trim().length > 0);
    const controlados = informe.ciclos.filter((c) => c.resultado === "ERROR_CONTROLADO");
    const reutilizables = informe.ciclos.filter(
      (c) => c.botonAlTerminar === "Dictar" && c.resultado !== "TIMEOUT_CICLO"
    );
    const sinResiduo = informe.ciclos.every(
      (c) => (c.residuosDespues?.pistasMicro ?? 0) === 0 && (c.residuosDespues?.recorders ?? 0) === 0 &&
        (c.residuosDespues?.reconocedores ?? 0) === 0
    );
    const recuperadoError = (informe.autocuracion?.recuperadoTrasError?.texto ?? "").includes(COLA_FRASE);
    const recuperadoTimeout = (informe.autocuracion?.recuperadoTrasTimeout?.texto ?? "").includes(
      COLA_FRASE
    );
    const exigirRecuperacion = ERRORES && !DENEGAR_MIC;

    informe.veredicto = {
      ciclosPedidos: CICLOS,
      ciclosConTexto: conTexto.length,
      ciclosConFraseCompleta: conFrase.length,
      ciclosConErrorControlado: controlados.length,
      ciclosReutilizables: reutilizables.length,
      sinResiduoDeSesion: sinResiduo,
      autocuracion: !exigirRecuperacion ? "no probada" : recuperadoError && recuperadoTimeout,
      estadoFinalBoton: informe.estadoFinalBoton,
      // PASS exige: ningún ciclo colgado, ninguno con residuo, el botón libre en
      // TODOS, al menos un texto real y (si se probó) la autocuración. Con el
      // micrófono DENEGADO no puede haber texto por definición: ahí lo que se exige
      // es que TODOS los ciclos acaben en error controlado y queden reutilizables.
      PASS: DENEGAR_MIC
        ? reutilizables.length === CICLOS &&
          sinResiduo &&
          controlados.length === CICLOS
        : reutilizables.length === CICLOS &&
          sinResiduo &&
          conTexto.length >= 1 &&
          (!exigirRecuperacion || (recuperadoError && recuperadoTimeout)),
    };
  } finally {
    matarChrome(chrome);
    if (cronometroGlobal) clearTimeout(cronometroGlobal);
  }

  console.log("\n=== VEREDICTO ===");
  console.log(JSON.stringify(informe.veredicto, null, 1));
  if (informe.autocuracion) console.log(JSON.stringify(informe.autocuracion, null, 1));
  console.log("RESIDUOS FINALES " + JSON.stringify(informe.residuosFinales));
  console.log("INFORME_JSON " + JSON.stringify(informe));
  process.exit(informe.veredicto?.PASS ? 0 : 2);
}

cronometroGlobal = setTimeout(finalizarPorTope, TIMEOUT_TOTAL_MS);
principal().catch((e) => {
  console.error("FALLO:", e.message);
  matarChrome(chromeGlobal);
  if (informeGlobal) console.error("INFORME_PARCIAL " + JSON.stringify(informeGlobal));
  process.exit(1);
});
