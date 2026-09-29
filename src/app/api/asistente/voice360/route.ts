/**
 * Voz 360 — Motor autónomo para Electricista360
 *
 * Reemplaza el proxy a localhost:3088 por un motor local que:
 * 1. Normaliza vocabulario eléctrico
 * 2. Detecta el intent del input (presupuesto, consulta, parte, factura, agenda)
 * 3. Ejecuta contra la BD local de Electricista360
 * 4. Gestiona el ciclo borrador → confirmación → guardado
 * 5. Devuelve { answer, draft, totals, pending_action } en el formato que espera la UI
 *
 * No depende de ningún servidor externo para las ACCIONES: las órdenes que
 * escriben datos son deterministas y pasan siempre por el Human Gate.
 *
 * IA REAL (preguntas abiertas): una pregunta que no es una orden ni una
 * consulta de datos se responde con el modelo configurado
 * (`llm-client.ts`), reutilizando el prompt de sistema y las guardas que ya usa
 * `/api/assistant`. Sin credencial, o si el modelo falla o tarda, se responde
 * con el motor local: la voz siempre tiene algo que mostrar.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase, generateBudgetNumber, generateParteNumber } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { electricistaDomainAdapter } from "@/lib/assistant/electricista-adapter";
import { splitItemSegments } from "@/lib/voice-order-parser";
import {
  buildSystemPrompt,
  answerAboutApp,
  answerCommercialQuery,
  isDangerousElectricalQuery,
  DANGEROUS_QUERY_RESPONSE,
} from "@/lib/assistant";
import { callAssistantChat } from "@/lib/assistant/llm-client";
import { getAuthenticatedIdentity, getAuthenticatedTenantId } from "@/lib/auth/require-session";
import { tenantColumnExists } from "@/lib/tenant/schema";
import type { CatalogItem } from "@/lib/ai-engine";
import type {
  Voice360Draft,
  Voice360Item,
  Voice360PendingAction,
  Voice360Totals,
} from "@/lib/assistant/types";

export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────────────────────
// Número en texto → dígito
// ────────────────────────────────────────────────────────────────────────────

/**
 * Números DICTADOS con letra.
 *
 * Al hablar un presupuesto ("cuatro enchufes a dieciocho euros, dos
 * magnetotérmicos a veintidós euros") el reconocedor puede devolver las
 * cantidades y los importes en palabras, no en cifras. Antes sólo se entendían
 * hasta el quince y algunos redondos, así que "dieciocho" o "veintidós" se
 * perdían y la línea quedaba sin precio o sin cantidad.
 *
 * Es una AMPLIACIÓN del vocabulario numérico existente (no un parser nuevo):
 * `parseNumber` y el patrón de partidas se construyen a partir de este único
 * mapa, para que no puedan divergir.
 */
const WORD_NUMBERS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11,
  doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, dieciséis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiun: 21, veintiuna: 21,
  veintidos: 22, veintidós: 22, veintitres: 23, veintitrés: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintiséis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, "treinta y uno": 31, cuarenta: 40, "cuarenta y cinco": 45,
  cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100,
};

/**
 * DECENAS COMPUESTAS ("treinta y cinco" = 35, "cuarenta y dos" = 42…).
 *
 * El mapa de arriba sólo traía dos compuestos sueltos (31 y 45), así que un
 * número tan normal como "treinta y cinco" NO se reconocía: el extractor casaba
 * "treinta" y la partida salía con 30 en lugar de 35, es decir, un presupuesto
 * con el importe MAL (y se guardaba así). Se generan de forma sistemática en vez
 * de enumerarlos a mano, para que no vuelva a faltar ninguno.
 */
const DECENAS_COMPUESTAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};
const UNIDADES_COMPUESTAS: Record<string, number> = {
  un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
};
for (const [decena, base] of Object.entries(DECENAS_COMPUESTAS)) {
  for (const [unidad, valor] of Object.entries(UNIDADES_COMPUESTAS)) {
    WORD_NUMBERS[`${decena} y ${unidad}`] = base + valor;
  }
}

/**
 * Alternancia de números (cifra o palabra) para los patrones de extracción.
 * Las claves largas van primero para que "veinticinco" no se lea como "veinte".
 */
const NUM_ALT = `\\d+(?:[.,]\\d+)?|${Object.keys(WORD_NUMBERS)
  .sort((a, b) => b.length - a.length)
  .map((palabra) => palabra.replace(/ /g, "\\s+"))
  .join("|")}`;

function parseNumber(raw: string): number | null {
  const lower = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (WORD_NUMBERS[lower] !== undefined) return WORD_NUMBERS[lower];
  const n = Number(lower.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Normalización + intent detector
// ────────────────────────────────────────────────────────────────────────────

type Intent =
  | "budget_create"
  | "budget_add_item"
  | "budget_modify_item"
  | "budget_remove_item"
  | "budget_set_tax"
  | "budget_set_client"
  | "budget_confirm"
  | "budget_cancel"
  | "budget_query"
  | "client_query"
  | "invoice_query"
  | "parte_create"
  | "parte_add_note"
  | "parte_query"
  | "schedule_query"
  | "catalog_query"
  | "saludo"
  | "general";

/**
 * Respuesta al saludo / prueba de micrófono ("Hola, ¿me escuchas?").
 *
 * DELIBERADAMENTE CORTA: es lo primero que se lee en voz alta en una conversación
 * continua, y hasta ahora este turno devolvía la guía completa (257 caracteres,
 * ~12 s de locución) en lugar de confirmar que el asistente oye. Corta, concreta
 * y con una invitación a seguir: el usuario sabe en un segundo que el micrófono
 * funciona.
 */
const SALUDO_RESPONSE =
  "Sí, te escucho perfectamente. Dime qué necesitas: puedo preparar un presupuesto, " +
  "crear un parte de trabajo o consultar tus datos.";

function detectIntent(text: string, hayBorrador = false): Intent {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Cancelación / confirmación.
  // La cancelación se evalúa PRIMERO: una frase negativa ("no, confírmalo") nunca
  // puede convertirse en una confirmación que abra el Human Gate.
  //
  // OJO: "borra" a secas NO es cancelar el borrador: "borra el cable" es quitar
  // una LÍNEA (budget_remove_item). Cancelar exige decirlo del borrador entero.
  //
  // P0: antes bastaba con que apareciera la palabra "no" en CUALQUIER posición, así
  // que una locución tan normal como
  //   "Presupuesto para Juan, no sé cuántos enchufes"
  // DESCARTABA el borrador en curso (la respuesta iba sin draft y la pantalla lo
  // limpiaba): pérdida de trabajo silenciosa. Ahora la cancelación exige una ORDEN
  // de cancelación de verdad:
  //   1. un verbo de cancelación ("cancela", "cancélalo", "descarta", "borra el borrador");
  //   2. o un "no" que NIEGA explícitamente una confirmación ("no lo guardes",
  //      "no lo confirmes", "no guardes nada"): el "no" tiene que ir pegado al
  //      verbo de guardado (como mucho dos palabras en medio), no en cualquier
  //      parte de una frase larga;
  //   3. o un "no" a secas, que es una respuesta completa y sin ambigüedad.
  // Un "no" que no sea ninguna de las tres cosas (una duda: "no sé cuántos
  // enchufes") ya NO descarta nada.
  const ordenDeCancelacion =
    /\b(?:cancela(?:r|lo|la|los|las|me)?|descarta(?:r|lo|la)?|borra(?:r)?\s+(?:el\s+|todo\s+el\s+)?borrador)\b/.test(t);
  const negacionDeGuardado = /\bno\b(?:\s+\S+){0,2}\s+(?:confirm|guard|acept|grab)/.test(t);
  const noASecas = /^(?:no|nada)\b[\s.,;!?]*$/.test(t);
  if (ordenDeCancelacion || negacionDeGuardado || noASecas) {
    return "budget_cancel";
  }
  // Formas naturales inequívocas: confirma / confirmar / confírmalo / guárdalo / guardar.
  // El grupo se cierra con \b para que "confirmación" o "guardarropa" no disparen.
  //
  // El "sí" suelto ("sí", "sí, guárdalo", "sí házmelo") también confirma, pero
  // SÓLO al principio de la frase. Antes bastaba con que la palabra apareciera en
  // cualquier posición, así que un "si" condicional de relleno convertía un
  // dictado normal en una confirmación:
  //   "2 bombillas a 25 euros si puede ser"
  //     -> budget_confirm -> "No hay borrador activo para confirmar" (dictado perdido)
  // y con un borrador abierto llegaba a abrir el Human Gate en vez de añadir la
  // línea. Un "si" que introduce una condición ("si puede ser", "si es posible",
  // "si quieres") no es una respuesta afirmativa.
  const confirmacionExplicita = /\b(?:confirma(?:r|lo|me)?|guarda(?:r|lo|me)?|acepto)\b/.test(t);
  const arranqueAfirmativo = /^(?:si|ok|vale|correcto|perfecto|de acuerdo)\b/.test(t);
  const esCondicional =
    /\b(?:si|ok|vale)\s+(?:puede|puedes|podria|fuera|quieres|quiere|hace|acaso|tal|no|posible|necesario)\b/.test(t);
  // Lo que viene DESPUÉS del "sí/vale/ok" decide si es una respuesta o el arranque
  // de una orden. "vale, guarda" confirma; "vale, ponme dos bombillas a 25 euros"
  // es un DICTADO, y tratarlo como confirmación lo perdía entero (respondía "No hay
  // borrador activo para confirmar").
  const trasAfirmacion = t.replace(/^(?:si|ok|vale|correcto|perfecto|de acuerdo)\b[\s,.;:!]*/i, "").trim();
  const sigueSiendoConfirmacion =
    trasAfirmacion.length === 0 ||
    /^(?:que\s+)?(?:si\b|confirm|guard|hazl|hazm|vale\b|ok\b|correcto\b|perfecto\b|de acuerdo\b)/.test(trasAfirmacion) ||
    /^es\s+(?:correcto|exacto|asi|eso|verdad)\b/.test(trasAfirmacion);
  const afirmacionAlPrincipio = arranqueAfirmativo && !esCondicional && sigueSiendoConfirmacion;
  // "es correcto" / "es verdad" también es una respuesta afirmativa, pero TIENE que
  // ser la frase ENTERA: si no, "es verdad que son 30 euros" abría el diálogo de
  // guardado en vez de aplicar el precio (que es lo que el usuario está pidiendo).
  const confirmacionSuelta = /^es\s+(?:correcto|exacto|asi|eso|verdad)[\s.!]*$/.test(t);
  if (confirmacionExplicita || afirmacionAlPrincipio || confirmacionSuelta) return "budget_confirm";

  // "dame/quiero/necesito UN presupuesto" (con artículo) es CREAR, y se resuelve
  // ANTES de la rama de IVA. Si en vez de esto se añadieran esos verbos a
  // `isCreationRequest`, una orden legítima como
  //   "quiero poner el IVA del presupuesto al 10%"
  // se saltaría la rama de IVA y se quedaría en el 21% SIN AVISAR.
  if (/\b(?:dame|quiero|necesito|haz)\s+(?:un|el|otro|nuevo)\s+presupuesto\b/.test(t)) return "budget_create";

  // IVA / impuesto del borrador activo.
  // Se reconoce SÓLO con un verbo fiscal cuyo objeto sea el IVA ("añade IVA",
  // "pon IVA al 10%", "quita el IVA"), con una retirada explícita ("sin IVA") o
  // con una tasa explícita ligada al IVA ("IVA 0%").
  // Se excluyen las consultas de precios ("¿Cuánto cuesta un cuadro con IVA?")
  // y las peticiones explícitas de creación ("Crea un presupuesto sin IVA").
  // Debe resolverse ANTES de add_item/modify_item: una frase cuyo sujeto es el IVA
  // jamás puede interpretarse como artículo ni como modificación de línea.
  // "dame/quiero/necesito un presupuesto …" ya se ha resuelto antes de la rama de
  // IVA (ver arriba), así que aquí NO se amplía la lista de verbos: hacerlo dejaba
  // sin efecto las órdenes de cambiar la tasa.
  const isCreationRequest =
    /\b(hazme|crea|creame|crealo|nuevo|hacer|prepara|preparame|genera|generame)\b.*(presupuesto|presupu|budget)/.test(t) ||
    /\b(presupuesto|presupu|budget)\b.*(de|para)\b/.test(t);
  const isPriceQuery =
    /\b(cuanto\s+cuesta|cuanto\s+vale|que\s+precio|precio\s+de|busca|consulta|consultar|informacion)\b/.test(t);
  if (/\b(?:iva|impuesto)\b/.test(t) && !isCreationRequest && !isPriceQuery) {
    const fiscalVerbOnTax =
      /\b(?:a[ñn]ade|anade|agrega|incluye|pon|aplica|aplicar|cambia|modifica|actualiza|corrige|sube|baja|quita|quitar|elimina|eliminar)\s+(?:el\s+|la\s+|un\s+|una\s+|los\s+|las\s+)?(?:iva|impuesto)\b/.test(t);
    const taxRemoval = /\bsin\s+(?:el\s+|la\s+)?(?:iva|impuesto)\b/.test(t);
    const explicitRate = /\d+(?:[.,]\d+)?\s*(?:%|por\s+ciento)/.test(t);
    if (fiscalVerbOnTax || taxRemoval || (explicitRate && /\b(?:iva|impuesto)\b/.test(t))) {
      return "budget_set_tax";
    }
  }

  // QUITAR UNA LÍNEA — "quita el cable", "borra los magnetotérmicos", "elimina las horas".
  // Se resuelve DESPUÉS del IVA ("quita el IVA" es otra cosa) y antes de añadir o
  // modificar: es una corrección del borrador, nunca una acción persistida.
  const removeVerb = /\b(?:quita|quitar|elimina|eliminar|borra|borrar|saca|sacar|suprime|suprimir)\b/.test(t);
  if (removeVerb && !/\b(?:iva|impuesto|borrador)\b/.test(t)) {
    return "budget_remove_item";
  }

  // PRECIO DICHO EN VOZ NATURAL — "el magnetotérmico son 25 euros", "la hora vale 50".
  // Antes esta frase no era ni modificación ni consulta y acababa en el camino de
  // pregunta abierta: el precio nunca llegaba a la línea.
  if (
    !isCreationRequest &&
    !isPriceQuery &&
    /\b(?:son|es|vale|valen|cuesta|cuestan)\s+\d+(?:[.,]\d+)?\s*(?:euros?|€|eur\b)/.test(t)
  ) {
    return "budget_modify_item";
  }

  // PREGUNTA DE AYUDA / EXPLICACIÓN → conocimiento de la app + IA real.
  //
  // Se resuelve ANTES de las ramas de consulta porque una pregunta de ayuda
  // contiene palabras clave de datos y acababa devolviendo una LISTA en lugar de
  // una explicación: "¿Cómo añado un cliente?" contiene "cliente" y respondía
  // con los clientes de la BD.
  //
  // Es intencionadamente estrecho para no desviar órdenes: "¿Qué facturas tengo
  // pendientes?" o "Busca el cliente García" siguen siendo consultas de datos
  // reales. "Puedo…" sólo cuenta como pregunta si de verdad es interrogativa.
  const arranqueDeAyuda =
    /^(?:¿\s*)?(?:como\b|de\s+que\s+forma\b|donde\b|que\s+es\b|que\s+son\b|explicame\b|explica\b|para\s+que\s+sirve\b|ayuda\b)/.test(
      t
    );
  const preguntaConPuedo = /^(?:¿\s*)?puedo\b/.test(t) && t.includes("?");
  if (arranqueDeAyuda || preguntaConPuedo) {
    return "general";
  }

  // Presupuesto.
  //
  // DEFECTO REAL corregido: la lista de verbos no incluía las formas con enclítico
  // ("créame", "prepárame", "genérame"), así que «Créame un presupuesto» no se
  // reconocía como orden de creación y el asistente respondía con la guía de la
  // app («**Presupuestos** (/presupuestos) — Cómo usarlo…») en vez de empezar el
  // borrador. Se añaden las formas que faltaban, sin tocar el resto de la lista.
  if (/\b(hazme|crea|creame|crealo|nuevo|hacer|prepara|preparame|genera|generame)\b.*(presupuesto|presupu|budget)/.test(t)) return "budget_create";
  // "dame/quiero UN presupuesto" (con artículo) es CREAR. Se exige el artículo para
  // no confundirlo con "dame 2 presupuestos", que es una consulta de listado.
  if (/\b(?:dame|quiero|necesito|haz)\s+(?:un|el|otro|nuevo)\s+presupuesto\b/.test(t)) return "budget_create";
  if (/\b(presupuesto|presupu|budget)\b.*(de|para)\b/.test(t)) return "budget_create";
  // Modificación de una línea EXISTENTE — se evalúa ANTES de add_item.
  // Con el orden anterior, "pon el precio del cable a 8 euros" era capturada por
  // add_item (verbo "pon" + palabra "cable") y acababa AÑADIENDO una línea nueva
  // ("Euros") en vez de modificar la existente.
  // Un verbo puramente aditivo (añade/agrega/incluye) nunca es modificación, y un
  // objeto cuantificado justo tras el verbo ("pon 3 enchufes a 12 euros") sigue
  // siendo una adición.
  const hasModifyVerb = /\b(cambia|modifica|actualiza|corrige|pon|sube|baja)\b/.test(t);
  const hasPureAddVerb = /\b(a[ñn]ade|anade|agrega|incluye)\b/.test(t);
  const quantifiedObject =
    /\b(?:cambia|modifica|actualiza|corrige|pon|sube|baja)\s+(?:\d+(?:[.,]\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|veinticinco|treinta|cuarenta|cincuenta)\b/.test(t);
  // P0: "cambia cuatro enchufes por seis" — SIN artículo — es la forma que el
  // usuario dice de verdad al hablar. El objeto cuantificado pegado al verbo
  // ("cambia cuatro …") hacía que la frase NO se reconociera como modificación y
  // acabara en la rama de pregunta abierta: la corrección se perdía y la cantidad
  // seguía siendo 4. Sólo funcionaba la variante con artículo ("cambia los cuatro
  // enchufes por seis"), porque el artículo rompe ese patrón cuantificado.
  //
  // Lo que distingue esta corrección de una ADICIÓN es la forma "… por <cantidad>"
  // y que el verbo sea de corrección: "pon" es aditivo, así que
  // "pon 3 enchufes a 12 euros" y "añade 3 enchufes a 12 euros" siguen siendo
  // adiciones.
  const correccionCuantificada = new RegExp(
    `\\b(?:cambia|modifica|actualiza|corrige)\\s+(?:el\\s+|la\\s+|los\\s+|las\\s+|un\\s+|una\\s+|unos\\s+|unas\\s+)?(?:${NUM_ALT})\\s+\\S[\\s\\S]{0,40}?\\s+por\\s+(?:${NUM_ALT})\\b`
  ).test(t);
  if (hasModifyVerb && !hasPureAddVerb && (!quantifiedObject || correccionCuantificada)) {
    return "budget_modify_item";
  }

  // AÑADIR LÍNEA — cualquier verbo aditivo con una cantidad.
  //
  // Antes se exigía que la frase nombrara un artículo de una lista cerrada
  // (enchufe, cable, magnetot…): "añade dos horas de trabajo" no estaba en esa
  // lista y acababa en la rama de PARTES DE TRABAJO, devolviendo un listado en
  // lugar de añadir la línea.
  const verboAditivo =
    /\b(a[ñn]ade|anade|a[ñn]ademe|agrega|agregame|incluye|pon|ponme|ponle|meter|mete|meteme|dame|apunta)\b/.test(t);
  const hayCantidad = new RegExp(`\\b(?:${NUM_ALT})\\s+\\S`, "i").test(t);

  // Entidades de DATOS con rama propia. Una frase sobre ellas NUNCA es una línea
  // de presupuesto, aunque traiga cantidad y precio: "necesito 2 facturas de 30
  // euros" es una consulta, no una partida. Por eso esta guarda NO cede ante
  // `describePartidas`.
  const temaDeDatos =
    /\b(?:facturas?|clientes?|partes?\s+de\s+trabajo|agenda|citas?|contratos?|nominas?|impuestos?|leads?)\b/.test(t);
  // "catálogo" es distinto: no es una entidad que se liste, es de donde sale el
  // material. Así que cede cuando la frase trae partidas de verdad:
  // "ponme 2 tubos del catálogo a 5 euros" es un dictado, no una consulta.
  const mencionaCatalogo = /\bcatalogo\b/.test(t);

  // ¿La frase TRAE partidas de verdad (cantidad + importe o conector de precio)?
  // Se calcula aquí arriba porque varias ramas necesitan distinguir una ORDEN de
  // presupuesto de una CONSULTA que usa casualmente las mismas palabras.
  const tieneImporte = new RegExp(`(?:${NUM_ALT})\\s*(?:euros?|eur\\b|\u20ac|pesetas?)`, "i").test(t);
  const tieneConectorDePrecio = new RegExp(`\\b(?:a|de|por)\\s+(?:${NUM_ALT})\\b`, "i").test(t);
  const esInterrogativa =
    t.includes("?") || /^(?:que|cuanto|cuantos|cuanta|cuantas|como|donde|cuando|quien|por\s+que)\b/.test(t);
  const describePartidas =
    !esInterrogativa && !temaDeDatos && hayCantidad && (tieneImporte || tieneConectorDePrecio);

  // Pedir un LISTADO de datos no es dictar una partida. Se reconoce por el verbo
  // de petición + un sustantivo de dato, y NO se aplica cuando la frase trae
  // partidas de verdad. Sirve para que la rama aditiva no secuestre la frase:
  // sin esto, "dame 2 materiales" creaba una línea espuria ("2 ud de Materiales",
  // precio pendiente) y volvía a anunciar "Total actual: 0.00 €".
  const pideListadoDeDatos =
    !describePartidas &&
    /\b(?:dame|damelos|damelas|muestrame|ensename|lista|listame|ver|cuantos|cuantas)\b/.test(t) &&
    // Plural a propósito: "dame 2 horas de trabajo" es un DICTADO (línea con precio
    // pendiente), no un listado, así que no puede casar con el singular "trabajo".
    /\b(?:presupuestos|facturas|clientes|trabajos|partes|materiales|gastos|proveedores|pedidos|leads|citas)\b/.test(t);
  const pideListadoDePresupuestos = pideListadoDeDatos && /\bpresupuestos?\b/.test(t);

  const bloqueaPorTema = temaDeDatos || (mencionaCatalogo && !describePartidas);

  // ── PARTE DE TRABAJO: CREAR (no consultar) ────────────────────────────────
  // Antes CUALQUIER mención de "parte"/"trabajo" acababa en `parte_query`, de modo
  // que "hazme un parte de trabajo" respondía "No hay partes de trabajo
  // registrados" y NO creaba nada: existía la consulta pero no la acción.
  //
  // Va ANTES de las consultas por dos motivos:
  //  1. la rama de CLIENTES se lleva "haz un parte para este cliente" (contiene
  //     "cliente"), que es una ORDEN de parte, no una búsqueda de clientes;
  //  2. la rama aditiva se lleva cualquier frase con cantidad.
  // La lista negra protege el caso contrario: "dame/ver/lista los partes" sigue
  // siendo una CONSULTA y no debe crear nada.
  const pideCrearParte =
    /\b(?:partes?|parte\s+de\s+trabajo)\b/.test(t) &&
    /\b(?:haz|hazme|hazmelo|hacer|crea|crear|creame|crealo|creale|nuevo|nueva|genera|generar|abre|abrir|apunta|apuntame|quiero|necesito|empieza)\b/.test(
      t
    ) &&
    !/\b(?:dame|damelos|damelas|muestrame|ensename|lista|listame|ver|cuantos|cuantas|consultar|consultame|busca|buscar|estado|resumen)\b/.test(
      t
    );
  if (pideCrearParte) return "parte_create";

  // ── PARTE DE TRABAJO: AÑADIR UNA OBSERVACIÓN ("añade que …") ──────────────
  // Segunda mitad del flujo real de conversación continua:
  //   1. "hazme un parte de trabajo para revisar una instalación"
  //   2. "añade que se revisaron los enchufes"   <- ESTA rama
  // La frase (2) NO trae cantidad ni precio, así que no es una línea de
  // presupuesto; antes caía en la ayuda genérica ("Puedo ayudarte con
  // presupuestos, clientes, facturas…") y el usuario tenía que repetir la orden
  // entera. Sólo se captura la forma EXPLÍCITA "<verbo de añadir> que …": una
  // orden con cantidad ("añade 3 enchufes a 12 euros") o un cambio de cliente o
  // de IVA conserva su rama de siempre.
  const verboDeNota =
    /^(?:vale|bueno|pues|ok|oye|mira|entonces|a ver|correcto|perfecto|de acuerdo)?[,\s]*(?:anade|anademe|agrega|agregame|apunta|apuntame|anota|anotame|incluye|incluyeme|pon|ponme)\s+que\b/.test(
      t
    );
  if (
    verboDeNota &&
    !/\b(?:cliente|precio|euros?|eur\b|iva|presupuesto)\b/.test(t)
  ) {
    return "parte_add_note";
  }

  if (
    !isPriceQuery &&
    verboAditivo &&
    hayCantidad &&
    !bloqueaPorTema &&
    !pideListadoDeDatos
  ) {
    return "budget_add_item";
  }
  if (/\b(el\s+cliente\s+es|para\s+el\s+cliente|cliente[:\s]+|cliente\s+se\s+llama)/.test(t)) return "budget_set_client";
  if (
    pideListadoDePresupuestos ||
    /\b(presupuestos?)\b.*(pendientes?|activos?|lista|ver|mostrar|consultar|buscar)/.test(t)
  ) {
    return "budget_query";
  }

  // ── FRASE QUE DESCRIBE PARTIDAS (aunque NO diga "presupuesto") ────────────
  // Ésta es la forma en que el usuario habla de verdad:
  //   "dos bombillas a 25 euros cada una y una hora de trabajo a 30"
  //   "una hora de trabajo a treinta euros"
  //   "ponme dos bombillas de 25 y una hora a 30"
  // Ninguna contiene la palabra "presupuesto" ni un verbo aditivo que el router
  // reconociera ("ponme" no casaba con \bpon\b), así que caían en las ramas de
  // consulta: "una hora de trabajo a treinta euros" respondía "No hay partes de
  // trabajo registrados" (por la palabra "trabajo") y el resto recibía la ayuda
  // genérica. El borrador no llegaba a crearse y, peor, el turno devolvía
  // draft:null, que borraba el borrador que el usuario tuviera a medias.
  if (!isPriceQuery && describePartidas) {
    return hayBorrador ? "budget_add_item" : "budget_create";
  }

  // Sin precio todavía: "dos bombillas". El usuario está empezando a dictar, así
  // que hay que PEDIRLE el precio, no responderle con la ayuda genérica. Se
  // limita a frases cortas que empiezan por una cantidad y no pisan otro tema.
  const empiezaPorCantidad = new RegExp(`^\\s*(?:${NUM_ALT})\\b`, "i").test(t);
  if (!isPriceQuery && !bloqueaPorTema && !esInterrogativa && empiezaPorCantidad && hayCantidad && t.length <= 80) {
    return hayBorrador ? "budget_add_item" : "budget_create";
  }

  // Clientes
  if (/\b(clientes?|busca|consulta|informacion)\b.*(cliente|nombre|empresa)/.test(t) ||
      /\bcliente\b/.test(t)) return "client_query";

  // Facturas
  if (/\b(facturas?|cobro|cobrar|facturado|pendiente de cobro)/.test(t)) return "invoice_query";

  // Partes de trabajo
  if (/\b(partes?|parte de trabajo|trabajos?|encargo|faena|servicio)/.test(t)) return "parte_query";

  // Agenda
  if (/\b(agenda|cita|visita|programar|cuando|proxima)/.test(t)) return "schedule_query";

  // Catálogo
  if (/\b(catalogo|precio de|cuanto cuesta|cuanto vale|materiales?)/.test(t)) return "catalog_query";
  // ── SALUDO / PRUEBA DE MICRÓFONO ───────────────────────────────────────────
  // Va al FINAL a propósito: sólo llega aquí lo que NO ha casado con ninguna
  // acción ni consulta real, así que no puede robar el turno a una orden.
  //
  // Por qué existe: el primer turno de una conversación continua es, casi
  // siempre, "Hola, ¿me escuchas?". Antes caía en la ayuda genérica y el
  // asistente contestaba con la lista de ejemplos (257 caracteres leídos en voz
  // alta) en vez de confirmar que oye: el usuario no sabía si el micrófono
  // funcionaba. La respuesta de un saludo debe ser CORTA y hablada.
  if (
    /^(?:hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|hola buenas|hey|ey)\b/.test(t) ||
    /\bme\s+(?:escuchas|oyes|recibes|entiendes)\b/.test(t) ||
    /\b(?:estas|sigues)\s+ahi\b/.test(t) ||
    /\bprueba\s+de\s+(?:voz|audio|sonido|micro)\b/.test(t) ||
    /\bfunciona\s+el\s+(?:micro|microfono|audio)\b/.test(t)
  ) {
    return "saludo";
  }

  return "general";
}

// ────────────────────────────────────────────────────────────────────────────
// Extractor de ítems de presupuesto desde texto natural
// ────────────────────────────────────────────────────────────────────────────

interface ParsedItem {
  description: string;
  quantity: number;
  unit_price: number | null;
  unit: string;
}

/**
 * Palabras de unidad que SÍ se separan de la descripción.
 *
 * OJO: "hora"/"horas" NO están aquí a propósito. La línea debe conservar el
 * concepto hablado ("Hora de trabajo"), que es lo que el usuario lee y lo que
 * esperan las pruebas existentes; la cantidad ya va en su propio campo.
 */
const UNIT_MAP: Record<string, string> = {
  metro: "m", metros: "m", m: "m",
  caja: "caja", cajas: "caja",
  rollo: "rollo", rollos: "rollo",
  paquete: "paquete", paquetes: "paquete",
  bobina: "bobina", bobinas: "bobina",
  unidad: "ud", unidades: "ud", ud: "ud", uds: "ud",
};

const UNIT_ALT = "metros?|m\\b|cajas?|rollos?|paquetes?|unidades?|uds?|bobinas?";

/** Conectores que introducen un precio ("a 25", "de 25", "por 25", "25 €"). */
const CONECTOR_PRECIO = "(?:a|de|por|@)";

/** Monedas que el dictado puede pronunciar. */
const MONEDA_ALT = "(euros?|eur\\b|\u20ac|pesetas?)";

/**
 * Medidas que siguen a un número y NO son un precio.
 *
 * "dos tubos de 20 mm a 5 euros" o "un tubo de 3 metros a 10 euros": el "de 20" /
 * "de 3" es la ESPECIFICACIÓN del material, no un importe. Sin esta distinción,
 * esa mención se tomaba por un precio: se cortaba el concepto justo ahí y el
 * importe dictado se sustituía por la medida (un tubo de 3 metros a 10 euros
 * salía a 3 €, y ESE importe equivocado llegaba a guardarse).
 *
 * IMPORTANTE: la lista se DERIVA de UNIT_ALT (el mismo vocabulario de unidades
 * que usa el extractor) además de las medidas físicas. Enumerarlas a mano dejó
 * fuera el plural "metros" y "unidades", que es justamente como se habla.
 */
const MEDIDA_SIGUIENTE = new RegExp(
  `^\\s*(?:${UNIT_ALT}|mm\\b|mm2\\b|mm\u00b2|cm\\b|m\\b|m2\\b|m\u00b2|km\\b|amperios?|a\\b|` +
    `w\\b|watios?|kw\\b|v\\b|voltios?|kg\\b|g\\b|litros?|l\\b|pulgadas?|modulos?|m[oó]dulos?|` +
    `gramos?|toneladas?|horas?|dias?|d[ií]as?|meses?|a[nñ]os?)`,
  "i"
);

interface MencionPrecio {
  valor: number;
  moneda: "EUR" | "PESETAS";
  indice: number;
  /** Longitud del texto casado, para saber dónde acaba la mención. */
  longitud: number;
  /** true si el número iba acompañado de la moneda ("25 euros"). */
  explicita: boolean;
}

/** Todas las menciones de precio con MONEDA explícita ("veinticinco euros", "25 €"). */
function mencionesConMoneda(texto: string): MencionPrecio[] {
  const re = new RegExp(`(${NUM_ALT})\\s*${MONEDA_ALT}`, "gi");
  const salida: MencionPrecio[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const valor = parseNumber(m[1]);
    if (valor === null) continue;
    salida.push({
      valor,
      moneda: /peseta/i.test(m[2]) ? "PESETAS" : "EUR",
      indice: m.index,
      longitud: m[0].length,
      explicita: true,
    });
  }
  return salida;
}

/**
 * Precios dichos SIN nombrar la moneda ("dos bombillas de 25", "una hora a 30").
 *
 * Sólo se usan como RESPALDO cuando el segmento no trae ninguna moneda explícita:
 * así "presupuesto de 3 metros de cable a 4 euros" no confunde el 3 (cantidad)
 * con un precio, porque el 4 € explícito gana y esta vía ni se consulta.
 */
function mencionesSinMoneda(texto: string): MencionPrecio[] {
  const re = new RegExp(`\\b${CONECTOR_PRECIO}\\s+(${NUM_ALT})\\b`, "gi");
  const salida: MencionPrecio[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const valor = parseNumber(m[1]);
    if (valor === null) continue;
    salida.push({ valor, moneda: "EUR", indice: m.index, longitud: m[0].length, explicita: false });
  }
  return salida;
}

/**
 * ¿El texto que hay ENTRE dos menciones de precio es sólo relleno hablado?
 *
 * Es la pieza que distingue "un precio repetido en la MISMA partida" de "dos
 * partidas distintas". "cada una", "o", "y", "la hora", artículos y las propias
 * palabras de dinero NO son concepto; en cuanto aparece un sustantivo nuevo
 * ("mano de obra", "desplazamiento") estamos ante otra línea.
 */
function esRellenoEntrePrecios(texto: string): boolean {
  return (
    texto
      .replace(/[\u20ac\s,;.:]+/g, " ")
      .replace(
        /\b(?:y|e|o|u|cada|uno|una|un|unos|unas|la|el|los|las|por|de|del|a|al|aprox|aproximadamente|unidad|unidades|euro|euros|eur|peseta|pesetas)\b/gi,
        " "
      )
      .replace(/[\s,;.:]+/g, " ")
      .trim().length === 0
  );
}

/**
 * Parte un segmento que en realidad contiene VARIAS partidas con precio.
 *
 * POR QUÉ HACE FALTA
 * El segmentador sólo corta ante una cantidad nueva, porque "tubo de PVC y cobre"
 * tiene que seguir siendo UNA partida. Pero hay líneas que no llevan cantidad:
 *
 *   "dos bombillas a 25 euros y la mano de obra a 30 euros"
 *
 * Ahí no hay cantidad delante de "la mano de obra", así que todo cae en un mismo
 * segmento y la segunda línea se perdía (o, peor, se leían los dos precios como
 * una contradicción y se pedía aclaración).
 *
 * CRITERIO PARA CORTAR (deliberadamente estrecho)
 * Sólo se corta cuando YA ha aparecido un precio antes: si entre dos precios hay
 * un concepto nuevo, lo que viene detrás es otra línea. Así
 * "2 tubos de PVC y cobre a 10 euros" sigue siendo UNA sola partida, porque sólo
 * tiene un precio y nunca se llega a plantear el corte.
 */
/**
 * ¿Una mención sin moneda es en realidad una MEDIDA del material?
 *
 * "dos tubos de 20 mm a 5 euros": el "de 20" no es un precio, es la sección del
 * tubo. Si se toma por un precio, además de confundir el importe corta el
 * concepto justo ahí y la descripción pierde la medida.
 */
function esMedidaNoPrecio(texto: string, m: MencionPrecio): boolean {
  return (
    !m.explicita &&
    MEDIDA_SIGUIENTE.test(texto.slice(m.indice + m.longitud, m.indice + m.longitud + 14))
  );
}

/**
 * Menciones de precio que cuentan de verdad (sin las medidas del material).
 * La usan tanto el extractor de partidas como el detector de contradicciones,
 * para que no puedan divergir.
 */
function mencionesDePrecio(texto: string): MencionPrecio[] {
  return [
    ...mencionesConMoneda(texto),
    ...mencionesSinMoneda(texto).filter((m) => !esMedidaNoPrecio(texto, m)),
  ].sort((a, b) => a.indice - b.indice || b.longitud - a.longitud);
}

function partirSegmentoPorPrecios(segmento: string): string[] {
  const todas = mencionesDePrecio(segmento);
  if (todas.length < 2) return [segmento];

  const cortes: number[] = [];
  for (let i = 1; i < todas.length; i += 1) {
    const anterior = todas[i - 1];
    const desde = anterior.indice + anterior.longitud;
    if (desde >= todas[i].indice) continue; // menciones solapadas ("a 25" / "25 euros")
    const entre = segmento.slice(desde, todas[i].indice);
    if (esRellenoEntrePrecios(entre)) continue; // misma partida: no se corta

    // Se corta justo ANTES del concepto nuevo, dejando atrás el conector y el
    // artículo ("... y la |mano de obra a 30 euros").
    //
    // OJO con el `\b` del conector: sin él, `[yeou]` casaba con la PRIMERA LETRA
    // de cualquier palabra que empezara por e/o/u/y y la descripción salía
    // mutilada ("ordenadores" -> "Rdenadores", "extractores" -> "Xtractores").
    const conector = entre.match(/^[\s,;.]*(?:[yeou]\b[\s,;.]*)?(?:(?:el|la|los|las|un|una)\s+)?/i);
    const corte = desde + (conector ? conector[0].length : 0);
    if (corte > (cortes[cortes.length - 1] ?? 0)) cortes.push(corte);
  }

  if (cortes.length === 0) return [segmento];

  const partes: string[] = [];
  let inicio = 0;
  for (const corte of cortes) {
    partes.push(segmento.slice(inicio, corte).trim());
    inicio = corte;
  }
  partes.push(segmento.slice(inicio).trim());
  return partes.filter(Boolean);
}

/**
 * ¿El dictado trae DOS precios incompatibles?
 *
 * Caso real del informe: "dos bombillas a veinticinco pesetas cada una 25 euros".
 * El reconocedor puede mezclar una moneda antigua con la real, o dejar dos cifras
 * distintas en la misma frase. La regla es NO elegir por el usuario y NO calcular
 * 0: se pregunta. Repetir el MISMO valor ("a veinticinco ... 25 €") no es un
 * conflicto, es una redundancia normal al hablar, y no debe preguntar nada.
 */
/**
 * El grupo inicial de menciones que pertenecen a la MISMA partida.
 *
 * Recorre las menciones en orden y se detiene en la primera que tenga un
 * concepto nuevo por delante: a partir de ahí ya es otra línea.
 */
function mencionesDeLaMismaPartida(menciones: MencionPrecio[], segmento: string): MencionPrecio[] {
  const grupo: MencionPrecio[] = [menciones[0]];
  for (let i = 1; i < menciones.length; i += 1) {
    const anterior = menciones[i - 1];
    const desde = anterior.indice + anterior.longitud;
    if (desde < menciones[i].indice) {
      const entre = segmento.slice(desde, menciones[i].indice);
      if (!esRellenoEntrePrecios(entre)) break;
    }
    grupo.push(menciones[i]);
  }
  return grupo;
}

/**
 * ¿El dictado trae DOS precios incompatibles EN LA MISMA PARTIDA?
 *
 * Caso real del informe: "dos bombillas a veinticinco pesetas cada una 25 euros".
 * El reconocedor puede mezclar una moneda antigua con la real, o dejar dos cifras
 * distintas para el mismo artículo. La regla es NO elegir por el usuario y NO
 * calcular 0: se pregunta. Repetir el MISMO valor ("a veinticinco ... 25 €") no
 * es un conflicto, es una redundancia normal al hablar.
 *
 * Y, sobre todo, DOS PRECIOS DISTINTOS EN DOS LÍNEAS DISTINTAS no son un
 * conflicto: "dos bombillas a 25 euros y la mano de obra a 30 euros" es un
 * presupuesto perfectamente normal. Por eso la comprobación se limita al grupo de
 * menciones que comparten partida (ver `mencionesDeLaMismaPartida`); si se mirara
 * la frase entera, no se podría presupuestar casi nada.
 */
function detectarAmbiguedadDePrecio(texto: string): string | null {
  for (const crudo of splitItemSegments(texto)) {
    const segmento = limpiarRuidoDeSegmento(crudo);
    if (!segmento) continue;

    const explicitas = mencionesConMoneda(segmento);
    if (explicitas.length === 0) continue;

    const grupo = mencionesDeLaMismaPartida(explicitas, segmento);
    if (grupo.length < 2) continue;

    const monedas = new Set(grupo.map((m) => m.moneda));
    if (monedas.size > 1) {
      const pesetas = grupo.find((m) => m.moneda === "PESETAS");
      const euros = grupo.find((m) => m.moneda === "EUR");
      return (
        `⚠️ He oído dos monedas distintas en la misma partida` +
        `${pesetas ? ` (${pesetas.valor} pesetas)` : ""}${euros ? ` (${euros.valor} euros)` : ""}. ` +
        `No quiero elegir por ti. ¿Confirmas que son **${(euros ?? grupo[0]).valor} euros** por unidad?`
      );
    }

    const valores = [...new Set(grupo.map((m) => m.valor))];
    if (valores.length > 1) {
      return (
        `⚠️ He oído dos precios distintos en la misma partida: ${valores.map((v) => `${v} €`).join(" y ")}. ` +
        `No quiero elegir por ti. ¿Cuál es el precio por unidad?`
      );
    }
  }

  return null;
}

/**
 * Quita de un segmento el ruido del habla, SIN tirar las partidas que contenga.
 *
 * Antes bastaba con que un segmento contuviera la palabra "presupuesto" para
 * descartarlo ENTERO. Al dictar de corrido, la cabecera y una partida real caen
 * en el mismo segmento ("... una hora de trabajo 30 € me haces el presupuesto"),
 * así que la partida se perdía y el borrador salía con 0 líneas y total 0,00 €.
 * Ahora se recorta SÓLO la cabecera y la coletilla, y lo de en medio se conserva.
 */
function limpiarRuidoDeSegmento(segmento: string): string {
  let s = segmento.trim();

  // 1. Coletilla final: "... me haces el presupuesto", "... y hazme el presupuesto".
  //
  //    OJO con el ancla: se exige que DELANTE del verbo haya contenido y un
  //    separador (`(?<=\S)[\s,;]+`). Sin eso, el patrón también casaba con la
  //    CABECERA del principio ("haz un presupuesto con dos bombillas...") y, como
  //    el `[\s\S]*$` se lo comía todo, el segmento entero desaparecía: la partida
  //    de las bombillas se perdía y sólo quedaba la segunda línea.
  s = s.replace(
    /(?<=\S)[\s,;]+(?:y\s+)?(?:me\s+)?(?:haces?|haz|hazme|prepara|crea|genera)\s+(?:el\s+|un\s+)?(?:presupuesto|presupu|budget)\b[\s\S]*$/i,
    ""
  );

  // 1.b MULETILLAS de arranque ("vale, ponme…", "bueno, dame…", "a ver, …").
  //
  //     Van ANTES de los verbos y son un paso aparte a propósito: el paso 2 está
  //     anclado al principio y busca VERBOS, así que con una muletilla delante no
  //     reconocía nada. La frase entonces no empezaba por número, la cantidad se
  //     quedaba en 1 y la muletilla acababa dentro de la descripción:
  //       "vale, ponme dos bombillas a 25 euros cada una"
  //         -> 1 ud "Vale, ponme dos bombillas" @25  (base 25 en vez de 50)
  //     Y eso se GUARDABA. Son palabras de relleno de habla real, no una orden.
  s = s.replace(
    /^(?:(?:vale|bueno|venga|pues|ok|si|eh|em|mmm|mira|oye|hombre|perfecto|correcto|entonces|ademas|además|a\s+ver|o\s+sea|es\s+decir|de\s+acuerdo)\b[\s,;.:]*)+/i,
    ""
  );

  // 2. Verbos de petición al principio ("ponme", "hazme", "quiero", "necesito").
  //    Incluye las formas con pronombre ("ponme", "añádeme"), que antes no
  //    contaban como verbo aditivo y dejaban la frase sin intent de presupuesto.
  //
  //    OJO con los ACENTOS: el dictado escribe "añádeme", "agrégame", "méteme".
  //    Sin cubrir las vocales acentuadas, el verbo no se retiraba y la partida
  //    salía con el verbo dentro de la descripción y cantidad 1:
  //    "añádeme dos bombillas a 25 euros" -> "Añádeme dos bombillas" x1, base 25
  //    (en vez de 2 x 25 = 50). El reconocedor no es constante con las tildes.
  //
  //    El grupo se REPITE (`(?:(?:…)\s+)+`) porque al hablar se encadenan varios
  //    ("hace falta pon dos bombillas…"): con una sola pasada quedaba "pon" delante
  //    de la cantidad, la frase no empezaba por número y salía 1 unidad.
  s = s.replace(
    /^(?:(?:quiero|necesito|hazme|haz|hacer|ponme|ponle|pon|mu[eé]strame|ens[eé][ñn]ame|mira|[aá][ñn][aá]deme|[aá][ñn][aá]de|agr[eé]game|agr[eé]ga|a[ñn]ademe|a[ñn]ade|agrega|m[eé]teme|mete|incl[uú]yeme|incluye|prepara|crea|genera|dame|apunta|hace\s+falta|hacen\s+falta|me\s+hacen\s+falta)\s+)+/i,
    ""
  );

  // 2.b Artículo delante de la cantidad ("LOS 2 tubos a 5 euros", "las 3 cajas").
  //     Sin retirarlo, la frase no empezaba por número, la cantidad quedaba en 1 y
  //     la descripción salía como "2 tubos corrugados" — un importe equivocado que
  //     además se GUARDABA. Sólo se retira si lo que sigue es realmente una
  //     cantidad: en "una hora de trabajo" el "una" ES la cantidad y se conserva.
  s = s.replace(
    new RegExp(`^(?:el|la|los|las|un|una|unos|unas)\\s+(?=(?:${NUM_ALT})\\b)`, "i"),
    ""
  );

  // 3. Cabecera "un presupuesto de/con/para X:". Si el conector es "para", se
  //    consume además el nombre del cliente, que no es una partida. Se exige que
  //    "presupuesto" aparezca al PRINCIPIO: si está al final ya lo ha retirado el
  //    paso 1 y aquí no hay nada que cortar.
  //
  //    El nombre se corta antes de "de/con", una coma, dos puntos o el final, y
  //    SIEMPRE con límite de palabra: sin `\b`, "Marta Delgado" se partiría en
  //    "Marta" (porque "De" de "Delgado" parece el conector) y la partida saldría
  //    con el cliente como descripción. Y se admite "de" además de ":" porque al
  //    dictar es igual de normal "Presupuesto para Marta de 2 tubos de PVC" que
  //    "Presupuesto para Marta: 2 tubos de PVC".
  const cabecera = s.match(/^(?:[\s\S]{0,40}?)\b(?:presupuesto|presupu|budget)\b\s*(.*)$/i);
  if (cabecera) {
    let resto = cabecera[1];
    const conPara = resto.match(/^para\s+[\p{L}][\p{L}\s]*?(?=\s*(?:de\b|con\b|,|:|$))/iu);
    if (conPara) {
      resto = resto.slice(conPara[0].length).replace(/^\s*(?:de\b|con\b|,|:)\s*/i, "");
    } else {
      resto = resto.replace(/^(?:de|con|para|:)\s*/i, "");
    }
    s = resto;
  }

  return s.replace(/\s+/g, " ").trim();
}

/** Limpia el concepto: conectores y muletillas que quedan al recortar el precio. */
function limpiarConcepto(concepto: string): string {
  return concepto
    .replace(/\s+/g, " ")
    .replace(/^(?:de|del|la|el|los|las|un|una|unos|unas)\s+/i, "")
    .replace(/[\s.,;:]+$/, "")
    .replace(/\s+(?:a|de|por|cada|la|el|los|las|un|una)$/i, "")
    .replace(/\s+(?:cada\s+un[ao]|cada\s+uno|por\s+unidad|la\s+hora|por\s+hora)$/i, "")
    .replace(/[\s.,;:]+$/, "")
    .trim();
}

/**
 * Extrae las líneas de presupuesto de un texto YA normalizado.
 *
 * La normalización de vocabulario eléctrico ocurre UNA sola vez, en la frontera
 * canónica POST /api/asistente/voice360 (normalizedInput -> handleBudgetCreate /
 * handleAddItem). No normalizar aquí otra vez: normalizeInput no es idempotente
 * y duplicaría las expansiones ("bases de enchufe" -> "bases de base de enchufe").
 *
 * GRAMÁTICA QUE ENTIENDE (una partida por segmento):
 *
 *     <cantidad> [unidad] <concepto> [(a|de|por)? <precio> (euros|€)?] [cola]
 *
 * Se acepta el precio con moneda ("25 euros", "25 €"), sin ella ("de 25",
 * "a 30"), en cifra o en letra ("veinticinco"), y con decimales de coma
 * ("3,5 metros a 2,75 euros"). La cola hablada ("cada una", "cada uno",
 * "la hora") se descarta. Si aparece el precio dos veces con el MISMO valor
 * ("a veinticinco ... 25 €") se usa ese valor; si los valores son incompatibles
 * o mezclan monedas, `detectarAmbiguedadDePrecio()` lo pregunta ANTES de llegar
 * aquí y este extractor no decide nada.
 *
 * Sin precio, la partida se devuelve igual con `unit_price: null`: el borrador
 * la muestra y pide lo que falta, en vez de inventar un 0 €.
 */
function extractBudgetItems(normalized: string): ParsedItem[] {
  const items: ParsedItem[] = [];

  // Una partida por SEGMENTO. El corte lo decide splitItemSegments(), el mismo
  // separador que ya usa el parser de pedidos por voz: solo corta ante una
  // cantidad nueva ("... y dos horas ..."), así que
  //   "dos bombillas ... y dos horas de trabajo ..."  -> 2 partidas
  //   "tubo de PVC y cobre"                          -> 1 partida
  for (const segmentoCrudo of splitItemSegments(normalized)) {
    const limpio = limpiarRuidoDeSegmento(segmentoCrudo);
    if (!limpio) continue;

    // Un segmento puede esconder varias partidas cuando la segunda línea no
    // lleva cantidad ("... y la mano de obra a 30 euros"): partirSegmentoPorPrecios
    // las separa sin tocar el caso "tubo de PVC y cobre".
    for (const segmento of partirSegmentoPorPrecios(limpio)) {
      if (!segmento) continue;

      // ── Importe HUÉRFANO ───────────────────────────────────────────────────
      // Una pausa del dictado parte "dos bombillas, 25 euros cada una" en dos
      // segmentos (el separador corta ante una cantidad nueva) y el segundo trae
      // SÓLO el precio. Interpretarlo como partida daría un disparate
      // ("25 ud de Euros cada una"): se aplica a la línea anterior, que es de quien
      // el usuario está hablando.
      const mSoloImporte = segmento.match(new RegExp(`^(${NUM_ALT})\\s*${MONEDA_ALT}\\b`, "i"));
      if (mSoloImporte) {
        const cola = segmento
          .slice(mSoloImporte[0].length)
          .replace(/\s+/g, " ")
          .trim()
          .replace(/[\s.,;:]+$/, "");
        const esSoloCola = /^(?:(?:cada\s+un[ao]|la\s+hora|por\s+unidad|al\s+mes)\s*)*$/i.test(cola);
        const ultima = items[items.length - 1];
        if (esSoloCola && ultima && (ultima.unit_price === null || ultima.unit_price === undefined)) {
          const valor = parseNumber(mSoloImporte[1]);
          if (valor !== null) {
            ultima.unit_price = valor;
            continue;
          }
        }
      }

      // ── Cantidad al principio ──
      const reCantidad = new RegExp(`^(${NUM_ALT})\\b\\s*`, "i");
      const mCantidad = segmento.match(reCantidad);
      let resto: string;
      let qty = 1;
      if (mCantidad) {
        qty = parseNumber(mCantidad[1]) ?? 1;
        resto = segmento.slice(mCantidad[0].length);
      } else {
        // Sin cantidad explícita ("mano de obra a 50 euros") se asume 1 unidad.
        resto = segmento;
      }

      // ── Unidad opcional pegada a la cantidad ("3 metros de cable") ──
      let unit = "ud";
      const mUnidad = resto.match(new RegExp(`^(${UNIT_ALT})\\s+(?:de\\s+)?`, "i"));
      if (mUnidad) {
        const clave = mUnidad[1].toLowerCase();
        unit = UNIT_MAP[clave] ?? clave;
        resto = resto.slice(mUnidad[0].length);
      }

      // ── Precio: se corta el CONCEPTO en la primera mención, sea del tipo que sea ──
      const conMoneda = mencionesConMoneda(resto);
      // Las menciones SIN moneda se calculan SIEMPRE (no sólo como respaldo del
      // importe): sirven para saber DÓNDE acaba el concepto. Sin esto,
      // "dos bombillas a veinticinco ... 25 €" dejaba el precio hablado dentro de la
      // descripción ("Bombillas a veinticinco ...") porque el "25 €" explícito
      // aparecía mucho más a la derecha.
      const sinMoneda = mencionesSinMoneda(resto);
      // Una mención sin moneda seguida de una MEDIDA no es un precio, es la
      // especificación del material: se queda dentro del concepto.
      const sinMonedaValidas = sinMoneda.filter((m) => !esMedidaNoPrecio(resto, m));
      const candidatas = [...conMoneda, ...sinMonedaValidas];
      const todas = candidatas.length > 0 ? candidatas : [...conMoneda, ...sinMoneda];

      // Sin cantidad delante Y sin ningún precio no hay partida: es un resto de
      // cabecera o de nombre de cliente ("... de la Fuente"). Antes lo descartaba
      // el patrón (exigía número inicial); ahora que se admite "mano de obra a
      // 50 euros" hay que comprobarlo explícitamente para no inventar líneas.
      if (!mCantidad && todas.length === 0) continue;

      let concepto = resto;
      let unit_price: number | null = null;
      if (todas.length > 0) {
        const primera = todas.reduce((a, b) => (a.indice <= b.indice ? a : b));
        concepto = resto.slice(0, primera.indice);
        // El importe lo manda la moneda explícita; si no la hay, el conector
        // (y nunca una medida, que ya se ha descartado).
        unit_price = (conMoneda[0] ?? sinMonedaValidas[0] ?? sinMoneda[0]).valor;
      }

      const desc = limpiarConcepto(concepto);
      if (!desc || desc.length < 2) continue;
      // Una cabecera suelta ("Presupuesto") no es una partida.
      if (/^(?:presupuestos?|presupu|budget)$/i.test(desc)) continue;

      items.push({
        description: desc.charAt(0).toUpperCase() + desc.slice(1),
        quantity: qty,
        unit,
        unit_price,
      });
    }
  }

  return items;
}

// ────────────────────────────────────────────────────────────────────────────
// Calcular totales de un borrador
// ────────────────────────────────────────────────────────────────────────────

function computeTotals(draft: Voice360Draft): Voice360Totals {
  const incomplete: string[] = [];
  let subtotal = 0;

  for (const item of draft.items) {
    if (item.unit_price === null || item.unit_price === undefined) {
      incomplete.push(item.description);
    } else {
      subtotal += item.quantity * item.unit_price;
    }
  }

  const taxRate = draft.tax_rate ?? 21;
  const tax_amount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + tax_amount) * 100) / 100;
  subtotal = Math.round(subtotal * 100) / 100;

  return { subtotal, tax_amount, total, incomplete };
}

// ────────────────────────────────────────────────────────────────────────────
// Confirmación token store (en memoria — idempotente por token)
// ────────────────────────────────────────────────────────────────────────────

interface PendingConfirmation {
  action: string;
  payload: Record<string, unknown>;
  label: string;
  expires_at: number;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

/**
 * Confirmaciones YA consumidas.
 *
 * IDEMPOTENCIA: una confirmación válida debe persistir COMO MÁXIMO un
 * presupuesto. El token es de un solo uso, pero un doble click, un reintento del
 * navegador o una reconexión pueden reenviar la misma petición: en ese caso NO se
 * vuelve a guardar nada y se devuelve la MISMA respuesta que la primera vez.
 */
const consumedConfirmations = new Map<string, { at: number; answer: string }>();
const CONSUMED_TTL_MS = 10 * 60 * 1000;

/**
 * Confirmaciones EN VUELO, por token.
 *
 * `consumeToken()` ocurre ANTES del `await` de escritura (para que nadie más
 * pueda escribir), así que entre el consumo y el registro en
 * `consumedConfirmations` existe una ventana en la que un duplicado concurrente
 * —doble click real, no secuencial— no encuentra el token pendiente y recibía un
 * 400. Aquí se guarda la PROMESA del guardado en curso: el duplicado la espera y
 * responde lo mismo, de forma idempotente.
 *
 * La entrada se retira en un `finally`, así que el mapa no crece.
 */
const inFlightConfirmations = new Map<string, Promise<HandlerResult>>();

function createConfirmToken(
  action: string,
  label: string,
  payload: Record<string, unknown>
): string {
  // Limpiar tokens expirados
  const now = Date.now();
  for (const [key, value] of pendingConfirmations.entries()) {
    if (value.expires_at < now) pendingConfirmations.delete(key);
  }
  for (const [key, value] of consumedConfirmations.entries()) {
    if (now - value.at > CONSUMED_TTL_MS) consumedConfirmations.delete(key);
  }

  const token = `v360-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pendingConfirmations.set(token, {
    action,
    label,
    payload,
    expires_at: now + 5 * 60 * 1000, // 5 minutos
  });
  return token;
}

/** Lee el token SIN consumirlo: permite validar antes de escribir nada. */
function peekToken(token: string): PendingConfirmation | null {
  const entry = pendingConfirmations.get(token);
  if (!entry) return null;
  if (entry.expires_at < Date.now()) {
    pendingConfirmations.delete(token);
    return null;
  }
  return entry;
}

function consumeToken(token: string): PendingConfirmation | null {
  const entry = peekToken(token);
  if (!entry) return null;
  pendingConfirmations.delete(token); // idempotente: consume una vez
  return entry;
}

/**
 * Reconstruye un borrador recibido del cliente (el usuario puede haberlo editado
 * a mano en la pantalla). NUNCA se aceptan los totales del cliente: se
 * recalculan aquí. Devuelve `null` si el borrador no es utilizable.
 */
function parseDraftFromClient(raw: unknown): Voice360Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<Voice360Draft>;

  if (!Array.isArray(candidate.items) || candidate.items.length === 0) return null;

  const items: Voice360Item[] = [];
  for (const rawItem of candidate.items) {
    if (!rawItem || typeof rawItem !== "object") return null;
    const item = rawItem as Partial<Voice360Item>;
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const quantity = Number(item.quantity);
    if (description.length === 0 || !Number.isFinite(quantity) || quantity <= 0) return null;

    const unitPrice =
      item.unit_price === null || item.unit_price === undefined ? null : Number(item.unit_price);
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) return null;

    items.push({
      id: typeof item.id === "string" && item.id.length > 0 ? item.id : crypto.randomUUID(),
      description: description.slice(0, 200),
      quantity: Math.min(quantity, 1_000_000),
      unit: typeof item.unit === "string" && item.unit.trim().length > 0 ? item.unit.trim().slice(0, 20) : "ud",
      unit_price: unitPrice,
      total: unitPrice === null ? undefined : Math.round(unitPrice * quantity * 100) / 100,
    });
  }

  const taxRate = Number(candidate.tax_rate ?? 21);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return null;

  return {
    revision: Number.isFinite(Number(candidate.revision)) ? Number(candidate.revision) : 1,
    client_name: typeof candidate.client_name === "string" ? candidate.client_name.slice(0, 120) : "",
    client_candidates: Array.isArray(candidate.client_candidates) ? candidate.client_candidates : [],
    tax_rate: taxRate,
    items,
    notes: Array.isArray(candidate.notes)
      ? candidate.notes.filter((note): note is string => typeof note === "string").slice(0, 20)
      : [],
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Handlers de intent
// ────────────────────────────────────────────────────────────────────────────

/**
 * ÚLTIMA LÍNEA TOCADA por el usuario, por id de línea.
 *
 * Hace falta para las correcciones que NO nombran ninguna línea
 * ("cambia el precio a 20 euros"): la referencia natural es lo último que el
 * usuario dictó o acaba de corregir. Se registra una sola vez por línea y con un
 * contador creciente (no con la hora: una locución crea varias líneas en el mismo
 * milisegundo y el orden tiene que ser determinista).
 *
 * Es una PISTA, nunca una decisión forzada: si la línea señalada no está en el
 * borrador que llega del cliente, el handler PREGUNTA en vez de adivinar.
 */
const ordenDeToqueDeLinea = new Map<string, number>();
let secuenciaDeToque = 0;

/** Marca una línea como "la última que el usuario ha tocado". */
function marcarLineaTocada(item: Voice360Item | undefined): void {
  if (!item || typeof item.id !== "string" || item.id.length === 0) return;
  // Cota de memoria: es sólo una pista de desambiguación, no un histórico.
  if (ordenDeToqueDeLinea.size > 1000) ordenDeToqueDeLinea.clear();
  secuenciaDeToque += 1;
  ordenDeToqueDeLinea.set(item.id, secuenciaDeToque);
}

/** Índice de la última línea tocada que sigue estando en el borrador, o -1. */
function indiceUltimaLineaTocada(items: Voice360Item[]): number {
  let mejorIndice = -1;
  let mejorOrden = -1;
  items.forEach((item, index) => {
    const orden = ordenDeToqueDeLinea.get(item.id);
    if (orden !== undefined && orden > mejorOrden) {
      mejorOrden = orden;
      mejorIndice = index;
    }
  });
  return mejorIndice;
}

/**
 * A QUÉ LÍNEA se refiere una corrección que NO nombra ninguna
 * ("cambia el precio a veinte euros").
 *
 * Regla explícita, sin inventar nada:
 *   · una sola línea en el borrador → ésa (no hay ambigüedad posible);
 *   · varias líneas → la ÚLTIMA que el usuario tocó (creó o corrigió), que es lo
 *     que acaba de dictar;
 *   · si tampoco se puede saber → -1 y el handler PREGUNTA.
 */
function indiceLineaSinNombrar(items: Voice360Item[]): number {
  if (items.length === 1) return 0;
  return indiceUltimaLineaTocada(items);
}

interface HandlerResult {
  answer: string;
  draft?: Voice360Draft;
  totals?: Voice360Totals;
  pending_action?: Voice360PendingAction;
  /**
   * Procedencia de la respuesta. Permite a la UI (y a las pruebas) distinguir
   * una respuesta de IA real de una determinista:
   *   "engine"        → motor determinista (acciones y consultas a la BD)
   *   "safety"        → guarda de seguridad eléctrica
   *   "crm-data"      → datos reales del CRM
   *   "app-knowledge" → conocimiento de la propia aplicación
   *   "ai"            → respuesta del modelo de lenguaje (IA real)
   *   "local"         → respaldo local cuando no hay IA disponible
   */
  source?: "engine" | "safety" | "crm-data" | "app-knowledge" | "ai" | "local";
}

async function handleBudgetCreate(
  text: string,
  currentDraft: Voice360Draft | null
): Promise<HandlerResult> {
  await initializeDatabase();
  const db = getDbClient();

  // ── 0. Dictado ambiguo: NO se interpreta, se pregunta ─────────────────────
  // Va lo PRIMERO, antes de tocar la BD o de construir nada: si el reconocedor
  // ha mezclado monedas ("veinticinco pesetas ... 25 euros") o ha dejado dos
  // precios incompatibles, la regla es no elegir arbitrariamente, no calcular 0
  // y no guardar. El borrador que ya hubiera se devuelve intacto.
  const ambiguedad = detectarAmbiguedadDePrecio(text);
  if (ambiguedad) {
    return {
      answer: ambiguedad,
      draft: currentDraft ?? undefined,
      totals: currentDraft ? computeTotals(currentDraft) : undefined,
    };
  }

  // Extraer cliente.
  // \p{L} con la bandera u: con \w los acentos no cuentan y "Juan Pérez" se
  // truncaba a "Juan P". Se admite ":" como terminador porque al dictar es
  // habitual decir "Presupuesto para Juan Pérez: dos bombillas ...".
  // "con" es también terminador: "presupuesto para Juan con 2 bombillas a 25 euros"
  // metía el conector en el nombre del cliente ("Juan con"). Igual pasa con la "y":
  // "presupuesto para Juan y dos bombillas a 25 euros" daba
  // "Juan y dos bombillas a". Se exige \b para que apellidos como "Conde" o
  // "Reyes" no se corten.
  const clientMatch =
    text.match(/para\s+([\p{L}][\p{L}\s]{1,39}?)(?=\s*(?:[:,]|\bde\b|\bcon\b|\by\b|\be\b|\bpara\b|$))/iu) ??
    text.match(/(?:cliente[:\s]+|para\s+)([\p{L}][\p{L}\s]{1,29})/iu);

  let clientName = clientMatch?.[1]?.trim() ?? "";

  // Buscar cliente en BD si se menciona un nombre
  let clientCandidates: Array<{ id: string; name: string; match_confidence?: number }> = [];
  if (clientName && clientName.length >= 2) {
    const res = await db.execute({
      sql: "SELECT id, name FROM clients WHERE name LIKE ? LIMIT 5",
      args: [`%${clientName}%`],
    });
    clientCandidates = res.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
    }));
    if (clientCandidates.length === 1) clientName = clientCandidates[0].name;
  }

  // Extraer ítems del texto
  const parsed = extractBudgetItems(text);
  const items: Voice360Item[] = parsed.map((p) => ({
    id: crypto.randomUUID(),
    description: p.description,
    quantity: p.quantity,
    unit: p.unit,
    unit_price: p.unit_price,
  }));

  // ── Ninguna partida entendida: NO se crea un presupuesto de 0,00 € ────────
  // Antes se creaba igualmente un borrador vacío y la pantalla decía
  // "Borrador creado · Total: 0.00 €", que es peor que no hacer nada: parece que
  // el presupuesto existe. Además ese borrador vacío no puede volver del cliente
  // (parseDraftFromClient exige al menos una línea), así que el turno siguiente
  // respondía "No hay borrador activo": el trabajo se perdía sin explicación.
  // Si YA había un borrador con líneas, se conserva y sólo se avisa.
  if (items.length === 0) {
    const previas = currentDraft?.items ?? [];
    if (previas.length === 0) {
      return {
        answer:
          "No he entendido bien las partidas. Dime cantidad, concepto y precio.\n\n" +
          'Por ejemplo: "dos bombillas a 25 euros cada una y una hora de trabajo a 30 euros".',
        draft: undefined,
      };
    }
    return {
      answer:
        "No he entendido ninguna partida nueva, así que dejo el borrador como estaba.\n\n" +
        'Dime por ejemplo: "dos bombillas a 25 euros cada una".',
      draft: currentDraft ?? undefined,
      totals: computeTotals(currentDraft as Voice360Draft),
    };
  }

  // Las líneas recién dictadas son, en orden, las últimas tocadas: una corrección
  // que no nombre ninguna línea se referirá a la última de éstas.
  items.forEach(marcarLineaTocada);

  const draft: Voice360Draft = {
    revision: (currentDraft?.revision ?? 0) + 1,
    client_name: clientName || currentDraft?.client_name || "",
    client_candidates: clientCandidates,
    tax_rate: 21,
    items,
    notes: [],
  };

  const totals = computeTotals(draft);

  const hasIncomplete = totals.incomplete.length > 0;
  const itemSummary = draft.items
    .map((i) =>
      `• ${i.quantity} ${i.unit} de ${i.description}${i.unit_price !== null ? ` — ${i.unit_price.toFixed(2)} €/ud` : " — precio pendiente"}`
    )
    .join("\n");

  let answer = `✅ Borrador creado${draft.client_name ? ` para **${draft.client_name}**` : ""}:\n\n${itemSummary}\n\n`;

  if (hasIncomplete) {
    answer += `⚠️ Faltan precios para: ${totals.incomplete.join(", ")}. Dímelos para calcular el total.\n`;
  } else {
    answer += `**Total: ${totals.total.toFixed(2)} €** (IVA incluido al 21%)\n\nDi "confirmar" cuando quieras guardar el presupuesto.`;
  }

  return { answer, draft, totals };
}

async function handleAddItem(
  text: string,
  currentDraft: Voice360Draft | null
): Promise<HandlerResult> {
  const parsed = extractBudgetItems(text);
  if (parsed.length === 0) {
    return { answer: "No he podido identificar el artículo o cantidad. Intenta con: \"Añade 3 enchufes a 12 euros\".", draft: currentDraft ?? undefined };
  }

  /**
   * COMPLETAR EL PRECIO DE UNA LÍNEA PENDIENTE EN VEZ DE DUPLICARLA.
   *
   * DEFECTO REAL corregido (bloqueaba el guardado por voz): al dictar primero el
   * concepto sin precio ("Añade 30 enchufes") y después el precio en su forma
   * natural ("Añade 30 enchufes a 12 euros"), esto creaba SIEMPRE una línea nueva
   * y dejaba la anterior SIN precio:
   *
   *     ["25 x Bases de enchufe @null", "30 x Bases de enchufe @12"]
   *
   * El Human Gate exige precios antes de guardar, así que el borrador quedaba
   * IMPOSIBLE DE GUARDAR por más que el usuario dijera el precio: el asistente se
   * quedaba pidiendo el precio de una línea que él mismo acababa de duplicar.
   *
   * Regla: si ya existe una línea del MISMO concepto y SIN precio (está esperando
   * tarifa), se COMPLETA con lo que el usuario acaba de dictar. Una línea que YA
   * tiene precio no se toca: volver a añadir el mismo material sigue creando una
   * línea aparte, como antes.
   */
  const normalizarDescripcion = (valor: string) =>
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const itemsPrevios: Voice360Item[] = (currentDraft?.items ?? []).map((item) => ({ ...item }));
  const newItems: Voice360Item[] = [];
  const completadas: Voice360Item[] = [];

  for (const p of parsed) {
    const sinPrecioNuevo = p.unit_price === null || p.unit_price === undefined;
    const clave = normalizarDescripcion(p.description);
    const indicePendiente = sinPrecioNuevo
      ? -1
      : itemsPrevios.findIndex(
          (item) =>
            normalizarDescripcion(item.description) === clave &&
            (item.unit_price === null || item.unit_price === undefined)
        );

    if (indicePendiente >= 0) {
      const completada: Voice360Item = {
        ...itemsPrevios[indicePendiente],
        quantity: p.quantity,
        unit: p.unit,
        unit_price: p.unit_price,
      };
      itemsPrevios[indicePendiente] = completada;
      marcarLineaTocada(completada);
      completadas.push(completada);
      continue;
    }

    const item: Voice360Item = {
      id: crypto.randomUUID(),
      description: p.description,
      quantity: p.quantity,
      unit: p.unit,
      unit_price: p.unit_price,
    };
    // La línea recién añadida es la última tocada del borrador.
    marcarLineaTocada(item);
    newItems.push(item);
  }

  const draft: Voice360Draft = {
    ...(currentDraft ?? { client_name: "", client_candidates: [], tax_rate: 21, notes: [], items: [] }),
    revision: (currentDraft?.revision ?? 0) + 1,
    items: [...itemsPrevios, ...newItems],
  };

  const totals = computeTotals(draft);
  const partes: string[] = [];
  if (completadas.length > 0) {
    partes.push(
      `✅ Precio completado en la línea que ya tenías:\n${completadas
        .map((i) => `• ${i.quantity} ${i.unit} de ${i.description} — ${i.unit_price?.toFixed(2)} €/ud`)
        .join("\n")}`
    );
  }
  if (newItems.length > 0) {
    partes.push(
      `✅ Añadido al borrador:\n${newItems.map((i) => `• ${i.quantity} ${i.unit} de ${i.description}`).join("\n")}`
    );
  }
  return {
    answer: `${partes.join("\n\n")}\n\nTotal actual: **${totals.total.toFixed(2)} €**`,
    draft,
    totals,
  };
}

/**
 * Localiza en el borrador la línea a la que se refiere una frase hablada.
 * Consume los artículos (el/la/los/las/un/una) para que "las horas" busque "horas",
 * y admite referencias genéricas ("cantidad", "unidades") sólo cuando el borrador
 * tiene una única línea, caso en el que no hay ambigüedad posible.
 * Devuelve -1 cuando el artículo no puede resolverse inequívocamente.
 */
function findItemIndex(items: Voice360Item[], spoken: string): number {
  const indices = findItemIndices(items, spoken);
  return indices.length > 0 ? indices[0] : -1;
}

/**
 * TODAS las líneas que coinciden con lo dicho.
 *
 * Se usa para no decidir por el usuario: si "el cable" coincide con dos líneas,
 * hay que preguntar cuál, no modificar la primera que aparezca (regla: si falta
 * información, PREGUNTAR; no inventar).
 */
function findItemIndices(items: Voice360Item[], spoken: string): number[] {
  const key = spoken
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(?:el|la|los|las|un|una|unos|unas)\s+/, "")
    .trim();

  const normalized = items.map((item) =>
    item.description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );

  if (key.length >= 2) {
    const direct = normalized
      .map((description, index) => (description.includes(key) ? index : -1))
      .filter((index) => index >= 0);
    if (direct.length > 0) return direct;

    // SEGUNDA PASADA, tolerante con la NORMALIZACIÓN del vocabulario.
    //
    // Las líneas del borrador pueden estar expandidas ("Bases de enchufe") mientras
    // lo que el usuario dice sigue siendo su palabra ("enchufes"), o al revés (una
    // línea editada a mano en pantalla). Quitando las palabras de relleno de la
    // referencia ("bases", "de") queda la palabra significativa ("enchufe"), que sí
    // aparece en la línea. Sólo se usa si la primera pasada no encontró NADA, para
    // no convertir una coincidencia exacta en una ambigüedad.
    const reducida = key
      .split(/\s+/)
      .filter((palabra) => !/^(?:bases?|de|del|el|la|los|las|un|una|unos|unas)$/.test(palabra))
      .join(" ")
      .trim();
    if (reducida.length >= 3 && reducida !== key) {
      const tolerante = normalized
        .map((description, index) => (description.includes(reducida) ? index : -1))
        .filter((index) => index >= 0);
      if (tolerante.length > 0) return tolerante;
    }
  }

  if (/^(?:cantidad|unidades|uds?)$/.test(key) && items.length === 1) return [0];

  return [];
}

/** Frase hablada → referencia de línea (sin artículos ni coletillas de precio). */
function referenciaDeLinea(raw: string): string {
  return raw
    .replace(/\s+(?:a|por)\s+\d+(?:[.,]\d+)?\s*(?:euros?|€|eur)?\s*$/i, "")
    .replace(/\s+(?:son|es|vale|valen|cuesta|cuestan)\s+\d+(?:[.,]\d+)?\s*(?:euros?|€|eur)\s*$/i, "")
    .replace(/[\s.,;:]+$/, "")
    .trim();
}

/** Importe formateado para las respuestas habladas (con coma decimal española). */
function euros(valor: number): string {
  return `${valor.toFixed(2).replace(".", ",")} €`;
}

/**
 * QUITAR UNA LÍNEA del borrador — "quita el cable".
 *
 * Sólo toca el borrador en memoria: no persiste nada. Si la referencia coincide
 * con varias líneas, NO se elimina ninguna y se pregunta cuál.
 */
async function handleRemoveItem(
  text: string,
  currentDraft: Voice360Draft | null
): Promise<HandlerResult> {
  if (!currentDraft || currentDraft.items.length === 0) {
    return {
      answer: "No hay borrador activo del que quitar nada. Empieza diciendo: \"Hazme un presupuesto de...\"",
    };
  }

  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = t.match(
    /\b(?:quita|quitar|elimina|eliminar|borra|borrar|saca|sacar|suprime|suprimir)\s+(.{2,40})/
  );
  const referencia = referenciaDeLinea(match?.[1] ?? "");
  const indices = findItemIndices(currentDraft.items, referencia);

  if (indices.length === 0) {
    const lineas = currentDraft.items.map((i) => `• ${i.description}`).join("\n");
    return {
      answer: `No encuentro "${referencia}" en el borrador. Estas son las líneas actuales:\n\n${lineas}`,
      draft: currentDraft,
      totals: computeTotals(currentDraft),
    };
  }

  if (indices.length > 1) {
    const opciones = indices
      .map((index) => `• ${currentDraft.items[index].description}`)
      .join("\n");
    return {
      answer: `Hay varias líneas que coinciden con "${referencia}". ¿Cuál quito?\n\n${opciones}`,
      draft: currentDraft,
      totals: computeTotals(currentDraft),
    };
  }

  const quitada = currentDraft.items[indices[0]];
  const items = currentDraft.items.filter((_, index) => index !== indices[0]);
  const draft: Voice360Draft = {
    ...currentDraft,
    revision: currentDraft.revision + 1,
    items,
  };
  const totals = computeTotals(draft);

  return {
    answer:
      `🗑️ Quitado del borrador: **${quitada.description}**.\n\n` +
      `Total actual: **${euros(totals.total)}**\n\nSigue SIN guardarse. Di "guárdalo" cuando quieras confirmar.`,
    draft,
    totals,
  };
}

/**
 * CLIENTE DEL BORRADOR — "el cliente es Juan Pérez".
 *
 * Sólo escribe `draft.client_name` (en memoria). Si el nombre coincide con un
 * cliente real se usa su nombre canónico; si no, se conserva lo dicho tal cual
 * y se avisa de que no existe en la base de datos (no se inventa un cliente).
 */
async function handleSetClient(
  text: string,
  currentDraft: Voice360Draft | null
): Promise<HandlerResult> {
  const match = text.match(
    /(?:el\s+cliente\s+es|cliente\s*:\s*|cliente\s+se\s+llama|para\s+el\s+cliente)\s*([\p{L}][\p{L}\s'.-]{1,39})/iu
  );
  const nombre = (match?.[1] ?? "").replace(/[\s.,;:]+$/, "").trim();

  if (nombre.length < 2) {
    return {
      answer: 'No he entendido el nombre. Dime por ejemplo: "El cliente es Juan Pérez".',
      draft: currentDraft ?? undefined,
    };
  }

  let canonico = nombre;
  let candidatos: Array<{ id: string; name: string }> = [];
  try {
    await initializeDatabase();
    const db = getDbClient();
    const res = await db.execute({
      sql: "SELECT id, name FROM clients WHERE name LIKE ? LIMIT 5",
      args: [`%${nombre}%`],
    });
    candidatos = res.rows.map((r) => ({ id: r.id as string, name: r.name as string }));
    if (candidatos.length >= 1) canonico = candidatos[0].name;
  } catch {
    // Sin BD se conserva el nombre dictado: el borrador no se pierde por esto.
  }

  const base: Voice360Draft =
    currentDraft ?? {
      revision: 0,
      client_name: "",
      client_candidates: [],
      tax_rate: 21,
      items: [],
      notes: [],
    };

  const draft: Voice360Draft = {
    ...base,
    revision: base.revision + 1,
    client_name: canonico,
    client_candidates: candidatos,
  };

  const aviso =
    candidatos.length === 0 ? "\n\n⚠️ No hay ningún cliente con ese nombre en la base de datos." : "";
  const totals = draft.items.length > 0 ? computeTotals(draft) : undefined;

  return {
    answer: `👤 Cliente del borrador: **${canonico}**.${aviso}\n\nSigue SIN guardarse.`,
    draft,
    totals,
  };
}

async function handleModifyItem(
  text: string,
  currentDraft: Voice360Draft | null
): Promise<HandlerResult> {
  if (!currentDraft || currentDraft.items.length === 0) {
    return { answer: "No hay borrador activo para modificar. Empieza diciendo: \"Hazme un presupuesto de...\"" };
  }

  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Mismo vocabulario numérico que la extracción de partidas (cifras y palabras):
  // así "cambia los cuatro enchufes por seis" y "el magnetotérmico son veintidós
  // euros" se entienden igual que si el reconocedor devolviera cifras.
  const NUM = `(${NUM_ALT})`;
  const VERBO = "(?:cambia|modifica|actualiza|corrige|pon|sube|baja)";

  // "cambia cuatro enchufes por seis" / "cambia 3 metros de cable por 5"
  //   → cambia la CANTIDAD de la línea (el "por" es lo natural al hablar).
  // "cambia el cable por 8 euros" (con moneda) → cambia el PRECIO unitario.
  const porMatch = t.match(
    new RegExp(`${VERBO}\\s+(?:el\\s+|la\\s+|los\\s+|las\\s+)?${NUM}\\s+(.{2,30}?)\\s+por\\s+${NUM}\\s*(euros?|€|eur\\b)?`)
  );

  // "cambia el precio del cable a 8 euros" / "… por 8 euros".
  const priceMatch = t.match(
    new RegExp(
      `${VERBO}\\s+(?:el\\s+|la\\s+|los\\s+|las\\s+)?precio\\s+(?:del?\\s+|de\\s+la\\s+)?(.{2,30}?)\\s+(?:a|por)\\s+${NUM}\\s*(?:euros?|€|eur\\b)?`
    )
  );

  // "el magnetotérmico son 25 euros", "la hora vale 50" → precio unitario.
  const copulaMatch = t.match(
    new RegExp(`(.{2,30}?)\\s+(?:son|es|vale|valen|cuesta|cuestan)\\s+${NUM}\\s*(?:euros?|€|eur\\b)`)
  );

  // Cambiar CANTIDAD — "cambia las horas a 10".
  // El artículo (el/la/los/las/un/una) se consume antes de capturar la referencia.
  const qtyMatch = t.match(
    new RegExp(
      `${VERBO}\\s+(?:el\\s+|la\\s+|los\\s+|las\\s+|un\\s+|una\\s+)?(.{2,30}?)\\s+a\\s+${NUM}\\s*(?:unidades?|uds?)?`
    )
  );

  // "…a 8 euros" sin la palabra "precio" sigue siendo un precio, no una cantidad.
  // El importe puede venir en cifra O en letra: al hablar ("a veinte euros") el
  // reconocedor devuelve palabras, y con el patrón anterior —sólo cifras— esa
  // frase se interpretaba como una CANTIDAD.
  const currencyAfterNumber = new RegExp(
    `\\b(?:a|por)\\s+(?:${NUM_ALT})\\s*(?:euros?|€|eur\\b)`
  ).test(t);

  // "cambia el precio a veinte euros" — PRECIO SIN NOMBRAR LA LÍNEA.
  //
  // P0: la frase es una modificación del borrador, pero no encajaba en ninguno de
  // los patrones de arriba: `priceMatch` exige un OBJETO detrás de "precio"
  // ("el precio DEL CABLE"), `copulaMatch` exige "son/es/vale" y
  // `currencyAfterNumber` era sólo para cifras, no para "a veinte euros".
  // Resultado: `qtyMatch` capturaba la palabra "precio" como si fuera el nombre de
  // una línea y el usuario recibía «No encuentro "precio" en el borrador».
  const precioSinLinea = t.match(
    new RegExp(`\\bprecios?\\b\\s*(?:unitarios?\\s*)?(?:a|por|en)\\s+${NUM}\\s*(?:euros?|€|eur\\b)?`)
  );

  let modified = false;
  const items = [...currentDraft.items];
  let respuestaNoEncontrado = "";
  let respuestaAmbigua = "";

  /** Aplica el cambio y devuelve el índice afectado, o -1 si no es inequívoco. */
  const aplicar = (
    referenciaCruda: string,
    mutar: (item: Voice360Item) => Voice360Item
  ): number => {
    const referencia = referenciaDeLinea(referenciaCruda);
    const indices = findItemIndices(items, referencia);
    if (indices.length === 0) {
      respuestaNoEncontrado = `No encuentro "${referencia}" en el borrador.`;
      return -1;
    }
    if (indices.length > 1) {
      respuestaAmbigua =
        `Hay varias líneas que coinciden con "${referencia}". ¿A cuál te refieres?\n\n` +
        indices.map((index) => `• ${items[index].description}`).join("\n");
      return -1;
    }
    const index = indices[0];
    items[index] = mutar(items[index]);
    // La línea corregida pasa a ser la última tocada del borrador.
    marcarLineaTocada(items[index]);
    modified = true;
    return index;
  };

  if (porMatch) {
    const valor = parseNumber(porMatch[3]);
    const esPrecio = Boolean(porMatch[4]);
    if (valor !== null) {
      aplicar(porMatch[2], (item) =>
        esPrecio
          ? { ...item, unit_price: valor, total: Math.round(valor * item.quantity * 100) / 100 }
          : { ...item, quantity: valor, total: Math.round((item.unit_price ?? 0) * valor * 100) / 100 }
      );
    }
  } else if (precioSinLinea) {
    // El usuario dice el precio pero NO la línea: se resuelve contra el borrador
    // (única línea, o la última tocada) y, si de verdad no se puede saber, se
    // PREGUNTA. Nunca se responde con un error ni se elige a ciegas.
    const newPrice = parseNumber(precioSinLinea[1]);
    if (newPrice !== null) {
      const index = indiceLineaSinNombrar(items);
      if (index === -1) {
        respuestaAmbigua =
          "¿A qué línea le pongo el precio? Dime cuál:\n\n" +
          items.map((item) => `• ${item.description}`).join("\n") +
          '\n\nPor ejemplo: "pon el precio del cable a 20 euros".';
      } else {
        items[index] = {
          ...items[index],
          unit_price: newPrice,
          total: Math.round(newPrice * items[index].quantity * 100) / 100,
        };
        marcarLineaTocada(items[index]);
        modified = true;
      }
    }
  } else {
    const priceSource = priceMatch ?? copulaMatch ?? (currencyAfterNumber ? qtyMatch : null);
    if (priceSource) {
      // priceMatch: [1]=referencia [2]=importe · copulaMatch: [1]=referencia [2]=importe
      const newPrice = parseNumber(priceSource[2]);
      if (newPrice !== null) {
        aplicar(priceSource[1], (item) => ({
          ...item,
          unit_price: newPrice,
          total: Math.round(newPrice * item.quantity * 100) / 100,
        }));
      }
    } else if (qtyMatch) {
      const newQty = parseNumber(qtyMatch[2]);
      if (newQty !== null) {
        aplicar(qtyMatch[1], (item) => ({
          ...item,
          quantity: newQty,
          total: Math.round((item.unit_price ?? 0) * newQty * 100) / 100,
        }));
      }
    }
  }

  if (!modified) {
    if (respuestaAmbigua) {
      return { answer: respuestaAmbigua, draft: currentDraft, totals: computeTotals(currentDraft) };
    }
    if (respuestaNoEncontrado) {
      return {
        answer:
          `${respuestaNoEncontrado} Estas son las líneas actuales:\n\n` +
          currentDraft.items.map((i) => `• ${i.description}`).join("\n"),
        draft: currentDraft,
        totals: computeTotals(currentDraft),
      };
    }
    return {
      answer:
        'No he podido aplicar el cambio. Puedes decir: "Cambia los cuatro enchufes por seis", ' +
        '"El magnetotérmico son 25 euros" o "Cambia las horas a 10".',
      draft: currentDraft,
      totals: computeTotals(currentDraft),
    };
  }

  const draft: Voice360Draft = { ...currentDraft, revision: currentDraft.revision + 1, items };
  const totals = computeTotals(draft);

  const detalle = items
    .map((i) => `• ${i.quantity} ${i.unit} · ${i.description} — ${euros(i.unit_price ?? 0)}/ud = ${euros((i.unit_price ?? 0) * i.quantity)}`)
    .join("\n");

  return {
    answer:
      `✅ Borrador actualizado (sigue SIN guardar):\n\n${detalle}\n\n` +
      `Base ${euros(totals.subtotal)} + IVA ${draft.tax_rate}% ${euros(totals.tax_amount)} = **${euros(totals.total)}**\n\n` +
      `Di "guárdalo" cuando quieras confirmar.`,
    draft,
    totals,
  };
}

/**
 * IVA del borrador — modifica EXCLUSIVAMENTE draft.tax_rate.
 *
 * No toca las líneas, no accede a la base de datos, no emite token ni
 * pending_action y no persiste nada: la escritura sigue ocurriendo SÓLO a través
 * del Human Gate ya existente (handleBudgetConfirm -> createConfirmToken ->
 * executeBudgetSave, que ya persiste draft.tax_rate).
 */
async function handleSetTax(
  text: string,
  currentDraft: Voice360Draft | null
): Promise<HandlerResult> {
  if (!currentDraft || currentDraft.items.length === 0) {
    return {
      answer:
        "No hay borrador activo para cambiar el IVA. Empieza diciendo: \"Hazme un presupuesto de...\"",
    };
  }

  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Tipo de IVA: "al 10%", "10 por ciento" o, al hablar, "cambia el IVA al 10".
  const rateMatch =
    t.match(/(\d+(?:[.,]\d+)?)\s*(?:%|por\s+ciento)/) ?? t.match(/\bal\s+(\d+(?:[.,]\d+)?)\b/);
  const isRemoval = /\b(?:quita|quitar|elimina|eliminar|sin)\b/.test(t);

  let newRate: number;
  if (rateMatch) {
    newRate = Number(rateMatch[1].replace(",", "."));
  } else if (isRemoval) {
    newRate = 0;
  } else {
    // Sin porcentaje: conservar la tasa vigente si ya es positiva; si el borrador
    // está a 0, aplicar el valor que Electricista360 ya usa en todo presupuesto nuevo.
    const current = Number(currentDraft.tax_rate);
    newRate = current > 0 ? current : 21;
  }

  if (!Number.isFinite(newRate) || newRate < 0 || newRate > 100) {
    return {
      answer: `⚠️ El IVA debe estar entre 0 y 100 (recibido: ${rateMatch?.[1] ?? "?"}). No se ha modificado el borrador.`,
      draft: currentDraft,
      totals: computeTotals(currentDraft),
    };
  }

  const changed = newRate !== Number(currentDraft.tax_rate);
  const draft: Voice360Draft = changed
    ? { ...currentDraft, revision: currentDraft.revision + 1, tax_rate: newRate }
    : currentDraft;
  const totals = computeTotals(draft);

  const answer = changed
    ? `✅ IVA actualizado al ${newRate}% (base ${totals.subtotal.toFixed(2)} € + IVA ${totals.tax_amount.toFixed(2)} €). Total: **${totals.total.toFixed(2)} €**\n\nDi "confirmar" para guardar.`
    : `ℹ️ El IVA ya está al ${newRate}%. Total: **${totals.total.toFixed(2)} €**\n\nDi "confirmar" para guardar.`;

  return { answer, draft, totals };
}

async function handleBudgetConfirm(
  currentDraft: Voice360Draft | null
): Promise<HandlerResult> {
  if (!currentDraft || currentDraft.items.length === 0) {
    return { answer: "No hay borrador activo para confirmar." };
  }

  const totals = computeTotals(currentDraft);
  if (totals.incomplete.length > 0) {
    return {
      answer: `⚠️ Faltan precios para: ${totals.incomplete.join(", ")}. Por favor indícalos antes de confirmar.`,
      draft: currentDraft,
      totals,
    };
  }

  const itemsSummary = currentDraft.items
    .map((i) => `• ${i.quantity} ${i.unit} de ${i.description} — ${((i.unit_price ?? 0) * i.quantity).toFixed(2)} €`)
    .join("\n");

  const label =
    `Crear presupuesto${currentDraft.client_name ? ` para ${currentDraft.client_name}` : ""}\n` +
    `${itemsSummary}\n` +
    `**Total: ${totals.total.toFixed(2)} €** (IVA ${currentDraft.tax_rate}%)`;

  const token = createConfirmToken("create_budget", label, {
    draft: currentDraft,
    totals,
  });

  const pending_action: Voice360PendingAction = {
    action: "create_budget",
    label,
    token,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };

  return {
    answer: `📋 Revisa el presupuesto antes de guardarlo:\n\n${itemsSummary}\n\n**Total: ${totals.total.toFixed(2)} €**\n\nPulsa "Confirmar" para guardar definitivamente.`,
    draft: currentDraft,
    totals,
    pending_action,
  };
}

async function executeBudgetSave(
  payload: Record<string, unknown>,
  tenantId: string | null = null
): Promise<HandlerResult> {
  try {
    await initializeDatabase();
    const db = getDbClient();

    const draft = payload.draft as Voice360Draft;
    const totals = payload.totals as Voice360Totals;

    // TENANT (Fase 2A). El presupuesto que se guarda por voz tiene que quedar
    // PROPIEDAD de su tenant: con `tenant_id NULL` la fila queda "sin propietario
    // demostrable" y desaparecería en cuanto la lectura se acote (semántica
    // aprobada en src/lib/tenant/schema.ts: se falla cerrado, nunca abierto).
    //
    // La migración de tenant es un script aparte que NO aplica
    // initializeDatabase(), así que la columna se comprueba antes de usarla: en una
    // base de datos sin migrar el guardado sigue funcionando exactamente igual que
    // antes (tenant_id ausente) en vez de romperse con "no such column".
    const conTenant =
      tenantId !== null &&
      (await tenantColumnExists(db, "budgets")) &&
      (await tenantColumnExists(db, "budget_items"));

    // Buscar o usar cliente
    let clientId: string | null = null;
    if (draft.client_name) {
      const clientRes = await db.execute({
        sql: "SELECT id FROM clients WHERE name LIKE ? LIMIT 1",
        args: [`%${draft.client_name}%`],
      });
      if (clientRes.rows.length > 0) {
        clientId = clientRes.rows[0].id as string;
      }
    }

    // Número de presupuesto (generador canónico PRES_XXXX)
    const budgetNumber = await generateBudgetNumber();
    const budgetId = crypto.randomUUID();
    const now = new Date().toISOString().split("T")[0];

    // Observaciones del borrador (editables en pantalla): se guardan en la
    // columna `notes` del presupuesto, que ya existe en el esquema.
    const observaciones = (draft.notes ?? [])
      .map((nota) => String(nota).trim())
      .filter((nota) => nota.length > 0)
      .join("\n")
      .slice(0, 2000);

    const cabeceraArgs = [
      budgetId,
      budgetNumber,
      clientId,
      now,
      totals.subtotal,
      draft.tax_rate,
      totals.tax_amount,
      totals.total,
      observaciones.length > 0 ? observaciones : null,
    ];

    const budgetStatements = [
      conTenant
        ? {
            // Convenio de tenant: `tenant_id` es la ÚLTIMA columna y su `?` el ÚLTIMO.
            sql: `INSERT INTO budgets (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total, notes, created_at, updated_at, tenant_id)
                  VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`,
            args: [...cabeceraArgs, tenantId],
          }
        : {
            sql: `INSERT INTO budgets (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total, notes, created_at, updated_at)
                  VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            args: cabeceraArgs,
          },
      ...draft.items.map((item, index) => {
        const lineaArgs = [
          crypto.randomUUID(),
          budgetId,
          item.description,
          item.quantity,
          item.unit_price ?? 0,
          (item.unit_price ?? 0) * item.quantity,
          index,
        ];
        return conTenant
          ? {
              sql: `INSERT INTO budget_items (id, budget_id, description, quantity, unit_price, total, sort_order, tenant_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [...lineaArgs, tenantId],
            }
          : {
              sql: `INSERT INTO budget_items (id, budget_id, description, quantity, unit_price, total, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
              args: lineaArgs,
            };
      }),
    ];

    // D4: la cabecera y TODAS las líneas se escriben como una única unidad atómica,
    // con el mismo patrón ya usado en /api/pedidos-voz. Si cualquier línea falla,
    // libsql revierte el lote completo: no queda un presupuesto huérfano ni se
    // consume el número PRES_XXXX. generateBudgetNumber() se ejecuta antes, como
    // lectura, y su valor entra como parámetro del lote.
    await db.batch(budgetStatements, "write");

    return {
      answer: `✅ **Presupuesto ${budgetNumber} guardado** correctamente${draft.client_name ? ` para ${draft.client_name}` : ""}.\n\nTotal: **${totals.total.toFixed(2)} €**\n\nPuedes verlo en la sección de Presupuestos.`,
    };
  } catch (err: any) {
    return {
      answer: `❌ No se pudo guardar el presupuesto: ${err?.message ?? "Error de base de datos"}. No se ha guardado el presupuesto ni ninguna de sus líneas.`,
    };
  }
}

/**
 * Extrae el nombre del cliente de una orden de parte de trabajo.
 *
 * Se limita a patrones EXPLÍCITOS ("para el cliente X", "cliente X", "para X" al
 * final) y descarta muletillas: en "haz un parte para este cliente" lo que sigue
 * a "para" es "este cliente", que no es un nombre. Sin nombre, el parte se crea
 * igual con un marcador y el asistente pide el dato, en vez de no crear nada.
 */
function extraerClienteParaParte(text: string): string | null {
  const patrones = [
    /\b(?:para|del?)\s+el\s+cliente\s+([\p{L}][\p{L}\s'.-]{1,39})/iu,
    /\bcliente\s+([\p{L}][\p{L}\s'.-]{1,39})/iu,
    /\bpara\s+([\p{L}][\p{L}\s'.-]{1,39})$/iu,
  ];
  const muletillas =
    /^(?:este|esta|ese|esa|aquel|el|la|los|las|un|una|mi|mis|nuestro|nuestra|trabajo|obra|parte|presupuesto|manana|hoy|ayer|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/i;

  for (const patron of patrones) {
    const bruto = (text.match(patron)?.[1] ?? "").replace(/[\s.,;:]+$/, "").trim();
    if (bruto.length < 2) continue;
    if (muletillas.test(bruto)) continue;
    if (esPropositoDeTrabajo(bruto)) continue;
    return bruto;
  }
  return null;
}

/**
 * ¿Lo capturado tras "para" es un PROPÓSITO del trabajo y no un cliente?
 *
 * DEFECTO REAL (comprobado en vivo): "Hazme un parte de trabajo para revisar una
 * instalación eléctrica" guardaba el parte con
 *   cliente = "revisar una instalación eléctrica"
 * porque el patrón "\bpara\s+<nombre>$" no distingue un nombre de una finalidad.
 * El parte quedaba con un cliente inventado —y sin poder enlazarlo a ningún
 * cliente del CRM—, que es peor que dejarlo pendiente de asignar.
 *
 * Se listan los verbos de ENCARGO del oficio (no una regla de sufijos: "Javier" y
 * "Pilar" terminan igual que un infinitivo y son nombres reales de cliente).
 */
function esPropositoDeTrabajo(valor: string): boolean {
  return /^(?:revis\w*|instal\w*|comprobar|comprueba\w*|arregl\w*|repar\w*|cambi\w*|sustitu\w*|monta\w*|coloc\w*|hacer|haz|medir|mide|verific\w*|presupuest\w*|mirar|mira|ajust\w*|conect\w*|termin\w*|acab\w*|entreg\w*|revisar\w*|localiz\w*|detect\w*|solucion\w*|instalar\w*)\b/i.test(
    valor
  );
}

/**
 * Extrae el ENCARGO dictado ("para revisar una instalación eléctrica") para
 * guardarlo como observación del parte.
 *
 * Sin esto el parte nacía completamente vacío (observaciones = null) y el usuario
 * tenía que volver a dictar el motivo. No inventa nada: sólo copia lo que dijo.
 */
function extraerEncargoParaParte(text: string): string | null {
  const bruto = (text.match(/\bpara\s+(?:el\s+cliente\s+)?([\p{L}][\p{L}\s'.,-]{3,79})/iu)?.[1] ?? "")
    .replace(/[\s.,;:]+$/, "")
    .trim();
  if (bruto.length < 4) return null;
  // Si lo capturado es un cliente no es un encargo (y al revés).
  if (!esPropositoDeTrabajo(bruto)) return null;
  return bruto;
}


/**
 * Crea un PARTE DE TRABAJO real.
 *
 * Esta es la acción que faltaba: el router sólo tenía `parte_query`, así que una
 * orden de creación se respondía con el listado ("No hay partes de trabajo
 * registrados") sin escribir nada. Aquí se inserta la fila de verdad con la MISMA
 * vía que el resto de la aplicación (`generateParteNumber()` de `@/lib/db` y el
 * esquema de `POST /api/partes-trabajo`), y sólo entonces se confirma al usuario.
 *
 * El parte nace en estado `borrador` —igual que los presupuestos no se guardan
 * solos—, de modo que crearlo por voz nunca firma ni cierra nada.
 */
async function handleParteCreate(
  text: string,
  currentDraft: Voice360Draft | null,
  sesion: string
): Promise<HandlerResult> {
  await initializeDatabase();
  const db = getDbClient();

  // Cliente: (1) el dictado en la frase, (2) el del presupuesto que se esté
  // dictando, (3) marcador pendiente. En (1) se intenta enlazar con un cliente
  // real del CRM por nombre.
  let cliente = extraerClienteParaParte(text) ?? (currentDraft?.client_name?.trim() || "");
  let clientId: string | null = null;
  if (cliente) {
    try {
      const res = await db.execute({
        sql: "SELECT id, name FROM clients WHERE name LIKE ? ORDER BY updated_at DESC LIMIT 1",
        args: [`%${cliente}%`],
      });
      if (res.rows.length > 0) {
        clientId = res.rows[0].id as string;
        cliente = res.rows[0].name as string;
      }
    } catch {
      // Sin CRM disponible se conserva el nombre dictado.
    }
  }
  const clienteFinal = cliente || "Cliente pendiente de asignar";
  // El motivo dictado se guarda como observación: el parte nace con el encargo
  // que el usuario acaba de decir, no vacío.
  const encargo = extraerEncargoParaParte(text);

  const numero = await generateParteNumber();
  const id = uuidv4();
  const now = new Date().toISOString();
  const fecha = now.slice(0, 10);

  await db.execute({
    sql: `INSERT INTO partes_trabajo (id, numero, fecha, tecnico, hora_inicio, hora_fin, cliente, client_id, direccion, telefono, persona_contacto, observaciones, estado, iva_rate, descuento, budget_id, visit_id, direccion_color, observaciones_color, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      numero,
      fecha,
      null,
      null,
      null,
      clienteFinal,
      clientId,
      null,
      null,
      null,
      encargo,
      "borrador",
      21,
      0,
      null,
      null,
      null,
      null,
      now,
      now,
    ],
  });

  // Se recuerda ESTE parte como el parte abierto de la conversación: es a donde
  // irá la observación del turno siguiente ("añade que se revisaron los
  // enchufes"). La marca es por SESIÓN y caduca sola, así que una frase suelta no
  // puede escribir en el parte de otra conversación ni en un parte antiguo.
  recordarParteDeLaSesion(sesion, {
    id,
    numero,
    observaciones: encargo,
    at: Date.now(),
  });

  const faltaCliente = !cliente;
  return {
    answer:
      `🔧 He creado el parte de trabajo **${numero}** para **${clienteFinal}** (estado: borrador).\n\n` +
      (faltaCliente ? "⚠️ Dime el cliente para completarlo: \"el cliente es ...\".\n\n" : "") +
      `Lo tienes en /partes-trabajo, listo para añadir trabajos y materiales.`,
    source: "engine",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// PARTE ABIERTO DE LA CONVERSACIÓN (segundo turno de la escucha continua)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Último parte creado POR VOZ en cada sesión.
 *
 * POR QUÉ POR SESIÓN Y CON CADUCIDAD
 * "Añade que se revisaron los enchufes" no nombra ningún parte: para saber a cuál
 * se refiere sólo hay una fuente honesta, el parte que ESTA conversación acaba de
 * crear. Buscar "el último parte de la base de datos" escribiría en el trabajo de
 * otra persona (o en un parte real cerrado), así que no se hace nunca.
 *
 * La marca caduca (PARTE_ABIERTO_MS) y el mapa está acotado: no crece sin fin ni
 * sobrevive a la conversación.
 */
const PARTE_ABIERTO_MS = 30 * 60_000;
const partesAbiertos = new Map<string, { id: string; numero: string; observaciones: string | null; at: number }>();

function recordarParteDeLaSesion(
  sesion: string,
  datos: { id: string; numero: string; observaciones: string | null; at: number }
): void {
  partesAbiertos.set(sesion, datos);
  if (partesAbiertos.size > 200) {
    for (const [clave, valor] of partesAbiertos) {
      if (Date.now() - valor.at > PARTE_ABIERTO_MS) partesAbiertos.delete(clave);
    }
  }
}

function parteAbiertoDeLaSesion(sesion: string) {
  const guardado = partesAbiertos.get(sesion);
  if (!guardado) return null;
  if (Date.now() - guardado.at > PARTE_ABIERTO_MS) {
    partesAbiertos.delete(sesion);
    return null;
  }
  return guardado;
}

/**
 * AÑADE UNA OBSERVACIÓN al parte abierto de esta conversación.
 *
 * Es la segunda mitad del flujo real: crear el parte y, en el turno siguiente,
 * dictar lo que se ha hecho. Escribe en `observaciones` (texto libre), no toca
 * importes, ni estados, ni líneas: el parte sigue en `borrador`.
 *
 * Si no hay parte abierto en ESTA conversación no se escribe nada y se dice con
 * claridad: es preferible a adivinar sobre qué parte escribir.
 */
async function handleParteAddNote(text: string, sesion: string): Promise<HandlerResult> {
  const nota = (text.match(/\bque\s+([\s\S]{3,200})$/i)?.[1] ?? "")
    .replace(/[\s.,;:]+$/, "")
    .trim();

  if (!nota) {
    return {
      answer: 'No he entendido qué quieres añadir. Dime por ejemplo: "añade que se revisaron los enchufes".',
      source: "engine",
    };
  }

  const abierto = parteAbiertoDeLaSesion(sesion);
  if (!abierto) {
    return {
      answer:
        "No tengo ningún parte abierto en esta conversación, así que no he añadido nada.\n\n" +
        'Dime primero: "hazme un parte de trabajo para ..." y después lo que quieras añadir.',
      source: "engine",
    };
  }

  await initializeDatabase();
  const db = getDbClient();

  try {
    const anterior = (abierto.observaciones ?? "").trim();
    const nueva = anterior ? `${anterior}\n${nota}` : nota;
    await db.execute({
      sql: "UPDATE partes_trabajo SET observaciones = ?, updated_at = ? WHERE id = ?",
      args: [nueva, new Date().toISOString(), abierto.id],
    });
    recordarParteDeLaSesion(sesion, { ...abierto, observaciones: nueva, at: Date.now() });

    return {
      answer:
        `✅ Añadido al parte de trabajo **${abierto.numero}**: "${nota}".\n\n` +
        `Sigue en estado borrador. Lo tienes en /partes-trabajo.`,
      source: "engine",
    };
  } catch (err: any) {
    return {
      answer: `⚠️ No he podido añadir la observación al parte ${abierto.numero}: ${err?.message ?? "error de base de datos"}. No se ha modificado nada.`,
      source: "engine",
    };
  }
}


async function handleQuery(intent: Intent, text: string): Promise<HandlerResult> {
  await initializeDatabase();
  const db = getDbClient();

  try {
    switch (intent) {
      case "client_query": {
        const nameMatch = text.match(
          /(?:cliente|busca|informacion\s+de|buscar)\s+([\w\s]{2,40})/i
        );
        const term = nameMatch?.[1]?.trim() ?? "";

        const res = await db.execute(
          term.length >= 2
            ? {
                sql: "SELECT id, name, status, phone, company FROM clients WHERE name LIKE ? OR company LIKE ? ORDER BY updated_at DESC LIMIT 5",
                args: [`%${term}%`, `%${term}%`],
              }
            : "SELECT id, name, status, phone, company FROM clients ORDER BY updated_at DESC LIMIT 8"
        );

        if (res.rows.length === 0)
          return { answer: `No encontré clientes${term ? ` con el nombre "${term}"` : ""}. Prueba con otro nombre o ve a la sección Clientes.` };

        const list = res.rows
          .map((r) => `• **${r.name}** ${r.company ? `(${r.company})` : ""} | ${r.status ?? "activo"} ${r.phone ? `| ☎ ${r.phone}` : ""}`)
          .join("\n");
        return { answer: `👤 Clientes encontrados:\n\n${list}` };
      }

      case "invoice_query": {
        const res = await db.execute(`
          SELECT i.number, i.total, i.status, i.due_date, c.name as client_name
          FROM invoices i
          LEFT JOIN clients c ON c.id = i.client_id
          ORDER BY i.created_at DESC LIMIT 8
        `);
        if (res.rows.length === 0)
          return { answer: "No hay facturas registradas." };

        const list = res.rows
          .map(
            (r) =>
              `• **${r.number}** — ${r.client_name ?? "Sin cliente"} — ${Number(r.total ?? 0).toFixed(2)} € — *${r.status}*${r.due_date ? ` — Vence: ${r.due_date}` : ""}`
          )
          .join("\n");
        return { answer: `🧾 Facturas recientes:\n\n${list}` };
      }

      case "parte_query": {
        const res = await db.execute(`
          SELECT p.numero, p.estado, p.fecha, COALESCE(c.name, p.cliente) as client_name
          FROM partes_trabajo p
          LEFT JOIN clients c ON c.id = p.client_id
          ORDER BY p.fecha DESC, p.created_at DESC LIMIT 8
        `);
        if (res.rows.length === 0)
          return { answer: "No hay partes de trabajo registrados." };

        const list = res.rows
          .map(
            (r) =>
              `• **${r.numero}** — ${r.client_name ?? "Sin cliente"} — *${r.estado}* — ${r.fecha ?? ""}`
          )
          .join("\n");
        return { answer: `🔧 Partes de trabajo recientes:\n\n${list}` };
      }

      case "schedule_query": {
        const today = new Date().toISOString().split("T")[0];
        const res = await db.execute({
          sql: `SELECT v.date, v.time, v.title, v.status, c.name as client_name
                FROM visits v
                LEFT JOIN clients c ON c.id = v.client_id
                WHERE date(v.date) >= ?
                ORDER BY v.date ASC, v.time ASC LIMIT 10`,
          args: [today],
        });
        if (res.rows.length === 0)
          return { answer: "No tienes visitas o citas programadas próximamente." };

        const list = res.rows
          .map(
            (r) =>
              `• **${r.date}${r.time ? ` ${r.time}` : ""}** — ${r.title ?? "Visita"} — ${r.client_name ?? "Sin cliente"}`
          )
          .join("\n");
        return { answer: `📅 Próximas visitas/citas:\n\n${list}` };
      }

      case "budget_query": {
        const res = await db.execute(`
          SELECT b.number, b.total, b.status, b.created_at, c.name as client_name
          FROM budgets b
          LEFT JOIN clients c ON c.id = b.client_id
          ORDER BY b.created_at DESC LIMIT 8
        `);
        if (res.rows.length === 0)
          return { answer: "No hay presupuestos registrados todavía." };

        const list = res.rows
          .map(
            (r) =>
              `• **${r.number}** — ${r.client_name ?? "Sin cliente"} — ${Number(r.total ?? 0).toFixed(2)} € — *${r.status}*`
          )
          .join("\n");
        return { answer: `📋 Presupuestos recientes:\n\n${list}` };
      }

      case "catalog_query": {
        // DEFECTO REAL corregido (P1 de voz): cuando la frase no casaba con los
        // patrones de búsqueda, se usaba LA FRASE ENTERA como término, así que
        // "¿Qué materiales tengo?" buscaba el literal "¿qué materiales tengo?" y
        // respondía «No encontré materiales»… con 57 materiales en el catálogo.
        // Es la pregunta más natural del usuario y contestaba que no hay nada.
        // Ahora: si la frase NOMBRA algo, se busca; si es una pregunta genérica,
        // se LISTA el catálogo.
        const qMatch = text.match(
          /(?:precio\s+(?:de|del?)\s+|cuanto\s+(?:cuesta|vale)\s+(?:el?\s+|la\s+)?|catalogo\s+de\s+|materiales?\s+de\s+|(?:busca|buscar|buscame|muestrame|ensename|dame|lista|listame|ver)\s+(?:el|la|los|las|un|una|unos|unas)?\s*)(.{2,60})/i
        );
        const termBruto = (qMatch?.[1] ?? "").trim();
        // Genérica = no hay término, o el "término" es la propia pregunta
        // ("materiales", "2 materiales", "qué materiales tengo").
        const esGenerica =
          termBruto === "" ||
          /^(?:\d+\s+)?(?:material(?:es)?|productos?|articulos?|catalogo)\b/.test(termBruto) ||
          /^(?:que|cuantos|cuantas|tengo|hay|tienes|disponibles?)\b/.test(termBruto);

        if (esGenerica) {
          const total = await db.execute("SELECT COUNT(*) AS n FROM catalog_items");
          const muestra = await db.execute(
            "SELECT name, unit_price, category FROM catalog_items ORDER BY category, name LIMIT 12"
          );
          const items = Number(total.rows[0]?.n ?? 0);
          if (items === 0) {
            return { answer: "El catálogo está vacío todavía. Puedes añadir materiales en la sección Catálogo." };
          }
          const listado = muestra.rows
            .map((r) => `• **${r.name}** — ${Number(r.unit_price ?? 0).toFixed(2)} €/ud — *${r.category}*`)
            .join("\n");
          return {
            answer: `📦 Tienes **${items}** materiales en el catálogo. Estos son ${muestra.rows.length}:\n\n${listado}\n\nDime cuál te interesa y te doy su precio.`,
          };
        }

        const term = termBruto;

        const res = await db.execute({
          sql: `SELECT name, unit_price, category FROM catalog_items
                WHERE name LIKE ? OR description LIKE ? OR category LIKE ?
                ORDER BY name LIMIT 8`,
          args: [`%${term}%`, `%${term}%`, `%${term}%`],
        });

        if (res.rows.length === 0)
          return { answer: `No encontré materiales para "${term}". Consulta el catálogo completo en la sección Catálogo.` };

        const list = res.rows
          .map((r) => `• **${r.name}** — ${Number(r.unit_price ?? 0).toFixed(2)} €/ud — *${r.category}*`)
          .join("\n");
        return { answer: `📦 Materiales encontrados:\n\n${list}` };
      }

      default:
        return { answer: LOCAL_HELP_TEXT, source: "local" };
    }
  } catch (err: any) {
    return {
      answer: `⚠️ Error consultando datos: ${err?.message ?? "Error de base de datos"}`,
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Preguntas abiertas — IA real, con el mismo orden de guardas que /api/assistant
// ────────────────────────────────────────────────────────────────────────────

/** Respuesta local cuando no hay IA disponible o el modelo falla. */
const LOCAL_HELP_TEXT =
  "Puedo ayudarte con presupuestos, clientes, facturas, partes de trabajo y agenda.\n\n" +
  'Ejemplos:\n• "Hazme un presupuesto de 4 enchufes a 18 euros para Carlos"\n' +
  '• "¿Qué facturas tengo pendientes?"\n• "Busca el cliente Fernández"\n' +
  '• "¿Qué trabajos tengo esta semana?"';

/**
 * Catálogo del usuario para el prompt. Defensivo: si la BD falla, se responde
 * con el prompt sin catálogo en lugar de fallar toda la pregunta.
 */
async function loadCatalogForVoice(): Promise<CatalogItem[]> {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const result = await db.execute(
      "SELECT id, name, unit_price, COALESCE(cost_price, 0) as cost_price, category FROM catalog_items ORDER BY category, name"
    );
    return result.rows as unknown as CatalogItem[];
  } catch {
    return [];
  }
}

/**
 * Instrucción de formato que se añade SOLO en la ruta de voz.
 *
 * El prompt del asistente es el mismo que usa el chat (no se duplica ni se
 * bifurca el conocimiento), pero una respuesta que se LEE EN VOZ ALTA no puede
 * ser una tabla ni una lista larga: el sintetizador la convierte en una
 * retahíla incomprensible. Por eso se pide prosa breve.
 */
const VOICE_FORMAT_RULES = `

FORMATO PARA VOZ (obligatorio en esta vía):
- Responde en 2 a 4 frases claras y directas, como si lo dijeras en voz alta.
- NO uses tablas, ni listas largas, ni bloques de código.
- Di las cifras y los nombres completos y despacio ("18 euros", "Juan Pérez").
- Nunca afirmes que has guardado o modificado algo: para escribir hace falta la confirmación del usuario.`;

/**
 * Pregunta abierta de voz.
 *
 * Mismo orden que `/api/assistant` (seguridad → datos reales → conocimiento de
 * la app → modelo → respaldo local). Reutiliza esas piezas, no las reimplementa.
 */
async function handleGeneralQuestion(text: string): Promise<HandlerResult> {
  // 1. Seguridad eléctrica: determinista y NUNCA delegada al modelo.
  if (isDangerousElectricalQuery(text)) {
    return { answer: DANGEROUS_QUERY_RESPONSE, source: "safety" };
  }

  // 2. Datos reales del CRM.
  const commercialAnswer = await answerCommercialQuery(text);
  if (commercialAnswer) {
    return { answer: commercialAnswer, source: "crm-data" };
  }

  // 3. Conocimiento de la propia aplicación (determinista, sin coste).
  const appAnswer = answerAboutApp(text);
  if (appAnswer) {
    return { answer: appAnswer, source: "app-knowledge" };
  }

  // 4. IA REAL. Sin credencial o ante cualquier fallo devuelve null.
  const catalog = await loadCatalogForVoice();
  const aiAnswer = await callAssistantChat({
    systemPrompt: buildSystemPrompt(catalog) + VOICE_FORMAT_RULES,
    query: text,
    temperature: 0.2,
    // Se pide brevedad porque la respuesta se lee en voz alta. El cliente
    // reintenta una vez con más margen si el modelo agota el presupuesto de
    // salida razonando (prompt largo + modelo con razonamiento).
    maxTokens: 900,
  });
  if (aiAnswer) {
    return { answer: aiAnswer, source: "ai" };
  }

  // 5. Respaldo local: la voz siempre responde algo útil.
  return { answer: LOCAL_HELP_TEXT, source: "local" };
}

// ────────────────────────────────────────────────────────────────────────────
// Handler principal POST
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // IDENTIDAD DEL SERVIDOR (Fase 2A): el tenant sale SIEMPRE del contexto que el
    // proxy inyecta tras validar la sesión, nunca del cuerpo ni de la query. Se lee
    // una sola vez y se usa para que el presupuesto guardado por voz quede en su
    // tenant en lugar de "sin propietario" (tenant_id NULL).
    const tenantId = getAuthenticatedTenantId(req);
    // SESIÓN que habla: acota el "parte abierto" a ESTA conversación (ver
    // `parteAbiertoDeLaSesion`). Nunca identifica al usuario para datos de negocio.
    const sesion =
      getAuthenticatedIdentity(req)?.sessionId ?? tenantId ?? "anonima";

    // ── Flujo de confirmación de acción pendiente ──
    if (body.confirm_token && typeof body.confirm_token === "string") {
      const token: string = body.confirm_token;

      // IDEMPOTENCIA: si esta confirmación ya se usó, se devuelve EXACTAMENTE la
      // misma respuesta y NO se vuelve a escribir. Un doble click, un reintento o
      // una reconexión no pueden producir un segundo presupuesto.
      const yaConsumida = consumedConfirmations.get(token);
      if (yaConsumida) {
        return NextResponse.json({
          answer: yaConsumida.answer,
          result: null,
          idempotent: true,
        });
      }

      // IDEMPOTENCIA CONCURRENTE (doble click REAL): el token se consume antes de
      // esperar a la base de datos, así que un duplicado que llegue en ese hueco ya
      // no encuentra el token pendiente y antes recibía un 400 confuso (sin
      // duplicar la fila, pero con un error para el usuario). Si hay una
      // confirmación EN VUELO con este token, se espera a ESA MISMA y se devuelve su
      // respuesta: un token ⇒ un presupuesto ⇒ una sola respuesta.
      const enVuelo = inFlightConfirmations.get(token);
      if (enVuelo) {
        const resultado = await enVuelo;
        return NextResponse.json({
          answer: resultado.answer,
          result: null,
          idempotent: true,
        });
      }

      const pending = peekToken(token);
      if (!pending) {
        return NextResponse.json(
          { error: "Token de confirmación inválido o expirado. Repite la acción." },
          { status: 400 }
        );
      }

      if (pending.action !== "create_budget") {
        return NextResponse.json(
          { error: `Acción desconocida: ${pending.action}` },
          { status: 400 }
        );
      }

      // El borrador puede haber sido EDITADO en pantalla después de abrir la
      // puerta de confirmación: se acepta el del cliente (validado y con los
      // totales recalculados en servidor). Si no viene, se usa el del token.
      const draftDelCliente = parseDraftFromClient(body.draft);
      const draftFinal = draftDelCliente ?? (pending.payload.draft as Voice360Draft | undefined);

      if (!draftFinal || !Array.isArray(draftFinal.items) || draftFinal.items.length === 0) {
        return NextResponse.json(
          { error: "El borrador no es válido: no se ha guardado nada." },
          { status: 400 }
        );
      }

      const totalsFinal = computeTotals(draftFinal);
      if (totalsFinal.incomplete.length > 0) {
        // NO se consume el token: el usuario puede completar los precios y volver
        // a confirmar sin repetir todo el flujo.
        return NextResponse.json(
          {
            error: `Faltan precios para: ${totalsFinal.incomplete.join(", ")}. Indícalos antes de guardar.`,
            draft: draftFinal,
            totals: totalsFinal,
          },
          { status: 400 }
        );
      }

      // A partir de aquí la escritura es definitiva: token consumido UNA vez.
      // La confirmación se marca EN VUELO antes de esperar a la base de datos (no
      // hay ningún `await` entre la comprobación de arriba y esta marca, así que un
      // duplicado concurrente no puede colarse en medio).
      consumeToken(token);
      const ejecucion = executeBudgetSave({ draft: draftFinal, totals: totalsFinal }, tenantId);
      inFlightConfirmations.set(token, ejecucion);

      let result: HandlerResult;
      try {
        result = await ejecucion;
      } finally {
        // Pase lo que pase, la marca en vuelo se retira: nadie queda esperando.
        inFlightConfirmations.delete(token);
      }

      consumedConfirmations.set(token, { at: Date.now(), answer: result.answer });
      return NextResponse.json({ answer: result.answer, result: null, idempotent: false });
    }

    // ── Flujo normal: procesar input de voz ──
    const rawInput: string =
      typeof body.input === "string" ? body.input.trim() : "";

    if (!rawInput) {
      return NextResponse.json(
        { error: "El campo 'input' es obligatorio." },
        { status: 400 }
      );
    }

    if (rawInput.length > 1000) {
      return NextResponse.json(
        { error: "Mensaje demasiado largo (máximo 1000 caracteres)." },
        { status: 400 }
      );
    }

    // Borrador actual enviado desde la UI
    const currentDraft: Voice360Draft | null = body.draft ?? null;

    // Normalizar input con vocabulario eléctrico
    const normalizedInput = electricistaDomainAdapter.normalizeInput
      ? (electricistaDomainAdapter.normalizeInput(rawInput) as string)
      : rawInput;

    // ── GUARDA DE SEGURIDAD ELÉCTRICA (antes de cualquier intent) ──
    // Se evalúa sobre TODA entrada, no solo sobre las preguntas abiertas: una
    // frase peligrosa ("cambia el magnetotérmico con tensión") contiene verbos
    // de modificación y antes podía acabar en una rama de borrador, con lo que
    // la advertencia de seguridad nunca llegaba a mostrarse. La respuesta de
    // seguridad es determinista y NO se delega al modelo.
    //
    // P0: la guarda devolvía `draft: null` y la pantalla asignaba ese null sin
    // condiciones, así que UNA sola frase peligrosa BORRABA de la pantalla el
    // presupuesto que el usuario tenía a medio dictar (pérdida de trabajo). Lo que
    // tiene que impedir la guarda es EJECUTAR la orden peligrosa y PERSISTIR, no
    // tirar el trabajo del usuario: el borrador se devuelve intacto y la
    // advertencia se muestra encima.
    if (isDangerousElectricalQuery(normalizedInput)) {
      const borradorConservado = parseDraftFromClient(currentDraft);
      return NextResponse.json({
        success: true,
        intent: "electricista:general",
        answer: DANGEROUS_QUERY_RESPONSE,
        source: "safety",
        draft: borradorConservado,
        totals: borradorConservado ? computeTotals(borradorConservado) : null,
        pending_action: null,
      });
    }

    // El router necesita saber si hay un borrador ACTIVO: con él, "pon tres
    // bombillas" es una modificación de ESE borrador; sin él, es crear uno nuevo.
    const hayBorradorActivo =
      Boolean(currentDraft) &&
      Array.isArray((currentDraft as Voice360Draft).items) &&
      (currentDraft as Voice360Draft).items.length > 0;

    const intent = detectIntent(normalizedInput, hayBorradorActivo);

    let result: HandlerResult;

    switch (intent) {
      case "budget_create":
        result = await handleBudgetCreate(normalizedInput, currentDraft);
        break;
      case "budget_set_tax":
        result = await handleSetTax(normalizedInput, currentDraft);
        break;
      case "budget_add_item":
        result = await handleAddItem(normalizedInput, currentDraft);
        break;
      case "budget_modify_item":
        result = await handleModifyItem(normalizedInput, currentDraft);
        break;
      case "budget_remove_item":
        result = await handleRemoveItem(normalizedInput, currentDraft);
        break;
      case "budget_set_client":
        result = await handleSetClient(normalizedInput, currentDraft);
        break;
      case "budget_confirm":
        result = await handleBudgetConfirm(currentDraft);
        break;
      case "budget_cancel":
        // El borrador se descarta: la respuesta va SIN draft y la pantalla lo limpia.
        result = {
          answer: "🗑️ Borrador descartado. No se ha guardado nada. Puedes empezar otro cuando quieras.",
        };
        break;
      case "parte_create":
        // ACCIÓN REAL: escribe el parte en la base de datos. Sin draft en la
        // respuesta, el borrador de presupuesto que hubiera se conserva intacto.
        result = await handleParteCreate(normalizedInput, currentDraft, sesion);
        break;
      case "parte_add_note":
        // ACCIÓN REAL sobre el parte abierto de ESTA conversación (segundo turno
        // de la escucha continua). Si no hay parte abierto no escribe nada.
        result = await handleParteAddNote(normalizedInput, sesion);
        break;
      case "saludo":
        // Primer turno de la conversación continua: "Hola, ¿me escuchas?".
        // Respuesta CORTA y hablada — no la guía de 257 caracteres de antes.
        result = { answer: SALUDO_RESPONSE, source: "engine" };
        break;
      case "general":
        // Pregunta abierta: conocimiento de la app + IA real (con respaldo local).
        // No pasa por la BD: no hay ninguna consulta de datos que hacer.
        result = await handleGeneralQuestion(normalizedInput);
        break;
      default:
        result = await handleQuery(intent, normalizedInput);
        break;
    }

    // ── EL BORRADOR NO PUEDE DESAPARECER POR UN TURNO QUE NO LO TOCA ────────
    // Antes se devolvía `result.draft ?? null`. Cualquier turno que no fuera de
    // presupuesto —una consulta, una pregunta abierta, un turno mal clasificado—
    // devolvía null y la pantalla hacía `setDraft(null)`: el presupuesto a medio
    // dictar se esfumaba y el turno siguiente contestaba "No hay borrador activo
    // para confirmar". Ahora sólo se vacía cuando el usuario lo pide de verdad
    // (cancelar) o cuando el guardado ya se ha hecho; en cualquier otro caso se
    // devuelve el borrador que había, intacto, para que sobreviva a tantos turnos
    // como haga falta (rerender, nueva transcripción, retry, respuesta TTS...).
    const borradorVigente = parseDraftFromClient(currentDraft);
    const conservarBorrador = result.draft === undefined && intent !== "budget_cancel";
    const draftParaCliente = result.draft !== undefined
      ? result.draft
      : conservarBorrador
        ? borradorVigente
        : null;
    const totalsParaCliente =
      result.totals !== undefined
        ? result.totals
        : conservarBorrador && borradorVigente
          ? computeTotals(borradorVigente)
          : null;

    return NextResponse.json({
      success: true,
      intent: intent === "budget_create" ? "electricista:budget_draft" : ("electricista:" + intent),
      answer: result.answer,
      source: result.source ?? "engine",
      draft: draftParaCliente,
      totals: totalsParaCliente,
      pending_action: result.pending_action ?? null,
    });
  } catch (err: any) {
    console.error("[voice360/route] error:", err);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        answer: "Error interno procesando la solicitud. Por favor inténtalo de nuevo.",
      },
      { status: 500 }
    );
  }
}
