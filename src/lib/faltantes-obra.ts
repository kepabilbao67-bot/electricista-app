/**
 * ELECTRICISTA360 — FALTANTES DE OBRA POR VOZ (P0-3)
 *
 * Qué es
 * ------
 * El electricista, en la obra, dicta lo que le falta y la app lo guarda asociado
 * a ese trabajo. Después puede preguntar "¿qué me falta?" y recibir SOLO la lista
 * de lo que sigue pendiente.
 *
 * Frase obligatoria (la del encargo):
 *   "Apunta que para este trabajo me faltan 20 metros de cable, dos cajas,
 *    diez tornillos y silicona."
 *   -> Cable | 20 | m | pendiente
 *      Caja  |  2 | ud | pendiente
 *      Tornillo | 10 | ud | pendiente
 *      Silicona | 1 | ud | pendiente
 *
 *   "Ya tengo las cajas y los tornillos."
 *   -> Caja y Tornillo pasan a "conseguido"; Cable y Silicona siguen pendientes.
 *
 *   "¿Qué me falta para esta obra?"
 *   -> SOLO: "20 m de cable" y "1 ud de silicona".
 *
 * Este módulo es LÓGICA PURA (sin base de datos ni React): se prueba con tests y
 * lo usan tanto la pantalla como la API.
 */

export type EstadoFaltante = "pendiente" | "conseguido";

export interface PartidaFaltante {
  producto: string;
  cantidad: number;
  unidad: string;
}

export interface FaltanteObra extends PartidaFaltante {
  id: string;
  parteId: string;
  estado: EstadoFaltante;
}

export type InterpretacionFaltantes =
  | { tipo: "agregar"; partidas: PartidaFaltante[] }
  | { tipo: "conseguido"; productos: string[] }
  | { tipo: "consulta" }
  | { tipo: "desconocido"; texto: string };

// ─────────────────────────────────────────────────────────────────────────────
// Números dictados
// ─────────────────────────────────────────────────────────────────────────────

const NUMEROS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
  mil: 1000,
};

/** Decenas que pueden formar compuesto con "y" ("treinta y cinco"). */
const DECENAS = new Set([
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
]);

/** Unidades sueltas que cierran un compuesto con "y". */
const UNIDADES_COMPUESTO = new Set([
  "un",
  "uno",
  "una",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Unidades de medida
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unidades de MEDIDA (van delante del material: "20 metros de cable").
 *
 * OJO: "cajas", "tornillos", "rollos"... NO están aquí a propósito. Un envase o
 * un objeto contable forma parte del NOMBRE del material ("Caja", "Tornillo"), no
 * son una unidad de medida; por eso "dos cajas" es Caja × 2 en unidades.
 */
const UNIDADES: Record<string, string> = {
  metro: "m",
  metros: "m",
  m: "m",
  mts: "m",
  mt: "m",
  centimetro: "cm",
  centimetros: "cm",
  cm: "cm",
  milimetro: "mm",
  milimetros: "mm",
  mm: "mm",
  kilo: "kg",
  kilos: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  kg: "kg",
  gramo: "g",
  gramos: "g",
  gr: "g",
  g: "g",
  litro: "l",
  litros: "l",
  l: "l",
  mililitro: "ml",
  mililitros: "ml",
  ml: "ml",
  unidad: "ud",
  unidades: "ud",
  ud: "ud",
  uds: "ud",
  u: "ud",
};

/** Palabras que se quitan del principio del dictado. */
const RELLENOS_INICIALES = [
  "apunta que",
  "apunta",
  "apuntame que",
  "apuntame",
  "anota que",
  "anota",
  "anotame que",
  "anotame",
  "recuerda que",
  "recuerda",
  "guarda que",
  "guarda",
  "dime que",
  "por favor",
  "para este trabajo",
  "para esta obra",
  "para el trabajo",
  "para la obra",
  "en este trabajo",
  "en esta obra",
  "me faltan",
  "me falta",
  "nos faltan",
  "nos falta",
  "me hacen falta",
  "me hace falta",
  "hacen falta",
  "hace falta",
  "faltan",
  "falta",
  "necesito",
  "necesitamos",
  "hay que comprar",
  "tengo que comprar",
  "hay que traer",
  "tengo que traer",
  "comprar",
  "traer",
  "que",
];

/** Artículos que se quitan delante de un material ("las cajas" -> "cajas"). */
const ARTICULOS = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "del", "de", "mi", "mis"]);

/** Palabras que introducen "ya lo tengo". */
const VERBOS_CONSEGUIDO = [
  "ya tengo",
  "ya tenemos",
  "ya consegui",
  "ya he conseguido",
  "he conseguido",
  "consegui",
  "ya compre",
  "he comprado",
  "ya he comprado",
  "compre",
  "ya estan",
  "ya los tengo",
  "ya las tengo",
  "ya lo tengo",
  "ya me han traido",
  "me han traido",
  "ya hay",
  "tengo ya",
  "tenemos ya",
];

/**
 * Palabras que NO son material. Un segmento SIN cantidad formado sólo por estas
 * palabras ("hola buenos días", "vale gracias") no es una partida: sin esta
 * comprobación, cualquier saludo del dictado se guardaba como material.
 */
const PALABRAS_NO_MATERIAL = new Set([
  "hola",
  "buenos",
  "buenas",
  "dias",
  "tardes",
  "noches",
  "gracias",
  "vale",
  "ok",
  "okey",
  "pues",
  "entonces",
  "ahora",
  "luego",
  "despues",
  "aqui",
  "alli",
  "eso",
  "esto",
  "esa",
  "ese",
  "si",
  "no",
  "ya",
  "que",
  "me",
  "te",
  "se",
  "nos",
  "lo",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "y",
  "de",
  "para",
  "por",
  "con",
  "sin",
  "es",
  "son",
  "esta",
  "este",
  "trabajo",
  "obra",
  "apunta",
  "apuntame",
  "anota",
  "anotame",
  "recuerda",
  "guarda",
  "dime",
  "faltan",
  "falta",
  "necesito",
  "necesitamos",
  "comprar",
  "traer",
  "material",
  "materiales",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de texto
// ─────────────────────────────────────────────────────────────────────────────

/** Minúsculas sin acentos: la comparación no debe depender de cómo se dictó. */
export function sinAcentos(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function limpiarEspacios(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** Quita signos de puntuación de los extremos de un segmento. */
function limpiarSegmento(texto: string): string {
  return limpiarEspacios(texto.replace(/^[\s.,;:¿?¡!()-]+|[\s.,;:¿?¡!()-]+$/g, ""));
}

/** Quita los rellenos del principio ("apunta que para este trabajo me faltan…"). */
export function quitarRellenos(texto: string): string {
  let actual = limpiarSegmento(texto);
  let cambio = true;
  while (cambio) {
    cambio = false;
    const plano = sinAcentos(actual);
    for (const relleno of RELLENOS_INICIALES) {
      if (plano === relleno) return "";
      if (plano.startsWith(relleno + " ")) {
        actual = limpiarSegmento(actual.slice(relleno.length));
        cambio = true;
        break;
      }
    }
  }
  return actual;
}

/** Divide el dictado en partidas: por comas y por "y" (respetando compuestos). */
export function dividirEnPartidas(texto: string): string[] {
  const salida: string[] = [];
  for (const trozo of texto.split(",")) {
    const tokens = limpiarEspacios(trozo).split(" ").filter(Boolean);
    let actual: string[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      const plano = sinAcentos(token);
      if (plano === "y" && actual.length > 0) {
        const anterior = sinAcentos(actual[actual.length - 1] ?? "");
        const siguiente = sinAcentos(tokens[i + 1] ?? "");
        // "treinta y cinco" es UN número, no dos partidas.
        if (DECENAS.has(anterior) && UNIDADES_COMPUESTO.has(siguiente)) {
          actual.push(token);
          continue;
        }
        salida.push(actual.join(" "));
        actual = [];
        continue;
      }
      actual.push(token);
    }
    if (actual.length > 0) salida.push(actual.join(" "));
  }
  return salida.map(limpiarSegmento).filter(Boolean);
}

/** Convierte "treinta y cinco" o "35" en 35. Devuelve null si no hay número. */
export function leerCantidad(texto: string): { cantidad: number | null; resto: string } {
  const limpio = limpiarSegmento(texto);

  const digitos = /^(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(limpio);
  if (digitos) {
    const valor = Number(digitos[1].replace(",", "."));
    if (Number.isFinite(valor)) return { cantidad: valor, resto: digitos[2] };
  }

  const tokens = limpio.split(" ").filter(Boolean);
  let total: number | null = null;
  let consumidos = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const plano = sinAcentos(tokens[i]);
    if (plano === "y" && total !== null && UNIDADES_COMPUESTO.has(sinAcentos(tokens[i + 1] ?? ""))) {
      consumidos = i + 1;
      continue;
    }
    const valor = NUMEROS[plano];
    if (valor === undefined) break;
    // "mil" multiplica lo anterior ("dos mil"); el resto suma.
    total = valor === 1000 ? (total ?? 1) * 1000 : (total ?? 0) + valor;
    consumidos = i + 1;
  }
  if (total === null) return { cantidad: null, resto: limpio };
  return { cantidad: total, resto: tokens.slice(consumidos).join(" ") };
}

/**
 * Singulariza un material dictado en plural.
 *
 * El español no permite decidir esto con una regla ciega, así que se resuelve con
 * el criterio que SÍ distingue los casos reales de material eléctrico:
 *
 *   "cajas"        -> "caja"        (vocal + s: se quita la s)
 *   "tornillos"    -> "tornillo"
 *   "enchufes"     -> "enchufe"
 *   "diferenciales"-> "diferencial" (consonante final + es: se quita "es")
 *   "interruptores"-> "interruptor"
 *   "cables"       -> "cable"       (raíz "cabl" no es una palabra: era "e" + s)
 *
 * La última es la que rompe las reglas simples: "cables" y "diferenciales"
 * terminan igual ("-les") pero su singular se forma distinto. Se distingue por la
 * letra ANTERIOR a la "l": si es consonante ("cabl"), la vocal se había perdido y
 * se recupera; si es vocal ("diferencial", "farol", "papel"), la palabra ya
 * estaba completa.
 */
const SINGULARES_EN_S = new Set(["gas", "compas", "atlas", "tos", "plus", "bus", "virus"]);

export function singularizar(palabra: string): string {
  const plano = sinAcentos(palabra);
  if (plano.length <= 3 || SINGULARES_EN_S.has(plano)) return palabra;
  if (!plano.endsWith("s")) return palabra;

  if (plano.endsWith("es") && plano.length > 4) {
    const raiz = palabra.slice(0, -2);
    const ultima = sinAcentos(raiz).slice(-1);
    const anterior = sinAcentos(raiz).slice(-2, -1);
    const esConsonante = (c: string) => c !== "" && !"aeiou".includes(c);
    // "cabl" -> "cable": la vocal se perdió al formar el plural.
    if (esConsonante(ultima) && esConsonante(anterior)) return raiz + "e";
    // "diferencial" / "papel" / "pared": la raíz ya era el singular.
    if ("lnrdzjsx".includes(ultima)) return raiz;
  }
  return palabra.slice(0, -1);
}

/** Nombre de material listo para mostrar: singular y con inicial mayúscula. */
export function normalizarProducto(texto: string): string {
  const limpio = limpiarSegmento(texto);
  if (!limpio) return "";
  // Se singulariza SÓLO la primera palabra: "cajas de registro" -> "Caja de registro".
  const tokens = limpio.split(" ");
  tokens[0] = singularizar(tokens[0]);
  const unido = tokens.join(" ");
  return unido.charAt(0).toUpperCase() + unido.slice(1);
}

/** Clave de comparación: minúsculas, sin acentos y en singular. */
export function claveProducto(producto: string): string {
  const normal = normalizarProducto(producto);
  const primera = normal.split(" ")[0] ?? "";
  return sinAcentos(primera);
}

/**
 * Convierte un segmento ("20 metros de cable", "dos cajas", "silicona") en una
 * partida. Devuelve null si el segmento no describe ningún material.
 */
export function parsearPartida(segmento: string): PartidaFaltante | null {
  const limpio = quitarRellenos(segmento);
  if (!limpio) return null;

  const { cantidad, resto } = leerCantidad(limpio);
  let cuerpo = limpiarSegmento(resto);
  // Tras la cantidad puede venir "de" ("20 de cable") o "metros de cable".
  cuerpo = limpiarSegmento(cuerpo.replace(/^de\s+/i, ""));
  if (!cuerpo) return null;

  // Sin cantidad, el segmento sólo vale si nombra algo que no sea relleno: así
  // "silicona" (que se sobreentiende 1 ud) entra, y "hola buenos días" no.
  if (cantidad === null) {
    const tokens = cuerpo.split(" ").filter(Boolean);
    if (tokens.every((t) => PALABRAS_NO_MATERIAL.has(sinAcentos(t)))) return null;
  }

  const tokens = cuerpo.split(" ").filter(Boolean);
  let unidad = "ud";
  let productoTexto = cuerpo;

  const posibleUnidad = UNIDADES[sinAcentos(tokens[0] ?? "")];
  if (posibleUnidad && tokens.length > 1) {
    unidad = posibleUnidad;
    productoTexto = limpiarSegmento(tokens.slice(1).join(" ").replace(/^de\s+/i, ""));
  }

  // Sin material identificable, o sólo una unidad suelta, no hay partida.
  const producto = normalizarProducto(productoTexto);
  if (!producto || UNIDADES[sinAcentos(producto)] !== undefined) return null;

  return {
    producto,
    cantidad: cantidad === null || cantidad <= 0 ? 1 : cantidad,
    unidad,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Interpretación del dictado
// ─────────────────────────────────────────────────────────────────────────────

function esConsulta(texto: string): boolean {
  const plano = sinAcentos(texto);
  return (
    // `\b` final imprescindible: sin él, "que me faltan 3 cajas" (un DICTADO) se
    // confundía con la pregunta "¿qué me falta?" y la lista no se guardaba.
    /que\s+(me|nos|te)?\s*falta\b/.test(plano) ||
    /que\s+falta\b/.test(plano) ||
    /cuales?\s+(me\s+|nos\s+)?faltan\b/.test(plano) ||
    /que\s+me\s+queda\b/.test(plano) ||
    /lista\s+de\s+faltantes\b/.test(plano) ||
    (/faltantes\s+de\s+(la\s+|esta\s+)?obra/.test(plano) && /que|lista|cuales/.test(plano))
  );
}

function verboConseguido(texto: string): string | null {
  const plano = sinAcentos(texto);
  for (const verbo of VERBOS_CONSEGUIDO) {
    if (plano.startsWith(verbo + " ") || plano === verbo) return verbo;
  }
  return null;
}

/** Quita artículos del principio de una partida ya dividida. */
function sinArticulos(texto: string): string {
  const tokens = limpiarSegmento(texto).split(" ").filter(Boolean);
  while (tokens.length > 1 && ARTICULOS.has(sinAcentos(tokens[0]))) tokens.shift();
  return tokens.join(" ");
}

/**
 * Interpreta un dictado y dice QUÉ hay que hacer con él.
 *
 * Es la única puerta de entrada: la pantalla y la API usan esto, así que el
 * comportamiento es idéntico en las dos.
 */
export function interpretarFaltantes(textoBruto: string): InterpretacionFaltantes {
  const texto = limpiarSegmento(textoBruto ?? "");
  if (!texto) return { tipo: "desconocido", texto: textoBruto ?? "" };

  // 1. ¿Es la pregunta por lo que falta?
  if (esConsulta(texto)) return { tipo: "consulta" };

  // 2. ¿Dice que YA lo tiene?
  const verbo = verboConseguido(texto);
  if (verbo) {
    // Se recorta sobre el texto normalizado (sin acentos): así el corte del verbo
    // no depende de que la normalización cambie o no la longitud de la cadena.
    const resto = limpiarSegmento(sinAcentos(texto).slice(verbo.length));
    const productos = dividirEnPartidas(resto)
      .map((segmento) => normalizarProducto(sinArticulos(segmento)))
      .filter(Boolean);
    if (productos.length > 0) return { tipo: "conseguido", productos };
  }

  // 3. ¿Está dictando lo que le falta?
  const partidas = dividirEnPartidas(quitarRellenos(texto))
    .map(parsearPartida)
    .filter((p): p is PartidaFaltante => p !== null);
  if (partidas.length > 0) return { tipo: "agregar", partidas };

  return { tipo: "desconocido", texto };
}

// ─────────────────────────────────────────────────────────────────────────────
// Presentación
// ─────────────────────────────────────────────────────────────────────────────

/** Cantidad legible: los enteros sin decimales, el resto con dos. */
export function formatearCantidad(cantidad: number): string {
  if (!Number.isFinite(cantidad)) return "0";
  return Number.isInteger(cantidad) ? String(cantidad) : String(Math.round(cantidad * 100) / 100);
}

/**
 * Lista de lo que FALTA, tal y como se responde en voz y en pantalla:
 *   "20 m de cable", "1 ud de silicona"
 */
export function formatearPendientes(items: PartidaFaltante[]): string[] {
  return items.map(
    (item) => `${formatearCantidad(item.cantidad)} ${item.unidad} de ${item.producto.toLowerCase()}`
  );
}

/** Texto hablado de la respuesta a "¿qué me falta?". */
export function respuestaPendientes(items: PartidaFaltante[]): string {
  const lista = formatearPendientes(items);
  if (lista.length === 0) return "No falta nada: tienes todo lo apuntado para esta obra.";
  if (lista.length === 1) return `Te falta ${lista[0]}.`;
  return `Te falta ${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}.`;
}
