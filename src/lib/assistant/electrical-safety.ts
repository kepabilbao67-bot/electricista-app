/**
 * Reglas de seguridad eléctrica obligatorias para el asistente.
 * Se inyectan en el prompt del sistema para garantizar respuestas seguras.
 */

export const ELECTRICAL_SAFETY_RULES = `
REGLAS DE SEGURIDAD ELÉCTRICA (OBLIGATORIAS — NO VIOLAR BAJO NINGUNA CIRCUNSTANCIA):

1. NUNCA des instrucciones para trabajar con tensión. Siempre recomienda: cortar alimentación, bloquear, verificar ausencia de tensión (5 reglas de oro).
2. Si el usuario pregunta cómo hacer algo con el circuito energizado, RECHAZA la petición y explica que es peligroso. Recomienda cortar la alimentación antes.
3. Para cuadros eléctricos, acometidas, instalaciones trifásicas, puntos de recarga de vehículo eléctrico, fotovoltaica, piscinas, locales de pública concurrencia y cualquier instalación con riesgo de arco eléctrico, añade siempre una advertencia de seguridad reforzada.
4. No guíes a personas no cualificadas en trabajos eléctricos peligrosos. Si detectas que el usuario no es profesional, recomienda contratar un instalador autorizado.
5. Las secciones de cable, protecciones y cálculos son ORIENTATIVOS. Siempre indica que deben verificarse con el REBT vigente, el proyecto específico y las condiciones reales de la instalación.
6. Ante riesgo de electrocución: derivar a instalador autorizado, OCA, ingeniería o distribuidora según corresponda.
7. No omitas advertencias de seguridad por brevedad. La seguridad siempre tiene prioridad sobre la concisión.
8. Si se menciona trabajo en altura + electricidad, advertir sobre doble riesgo y EPIs específicos.
`;

/**
 * Patrones de TRABAJO EN TENSIÓN / SIN AISLAMIENTO.
 *
 * Cada patrón es una forma REAL de decir "voy a trabajar con la instalación
 * energizada". El conjunto anterior exigía la preposición (`con`/`sin`/`en`)
 * pegada a la palabra clave, de modo que frases corrientes como
 *   "cambia el magnetotérmico bajo tensión"
 *   "trabaja con el cuadro en tensión"
 *   "quita el magnetotérmico con corriente"
 *   "sigue sin bajar el general"
 *   "corta el cable con la mano mojada"
 * NO se detectaban y llegaban al motor como una orden normal.
 *
 * REGLA AL AÑADIR PATRONES: la guarda se evalúa ANTES de cualquier intent, así
 * que un patrón demasiado ancho bloquearía presupuestos normales. Por eso todo lo
 * nuevo va anclado a una palabra de estado ("bajo/en tensión", "con corriente",
 * "mojada") y NO a palabras de material ("cable", "cuadro", "magnetotérmico"),
 * que aparecen en cualquier línea de presupuesto.
 *
 * IMPORTANTE: "sin tensión" (ausencia de tensión, que es el estado SEGURO) no
 * puede activar la guarda. Por eso la tensión sólo cuenta con bajo/en/con.
 */
const LIVE_WORK_PATTERNS: RegExp[] = [
  // Tensión presente en el circuito.
  /con\s+(?:la\s+|el\s+)?tensi[oó]n/,
  /(?:bajo|en)\s+(?:la\s+|el\s+)?tensi[oó]n/,
  // Trabajar con corriente (sin haber cortado).
  /con\s+(?:la\s+|el\s+)?corriente\b/,
  // Trabajar SIN hacer la maniobra segura previa.
  /sin\s+(?:cortar|desconectar|desconectarlo|desconectarla|quitar|quitarla|bajar|bajarlo)\b/,
  /sin.*cortar/,
  // Trabajo "en caliente".
  /en.*caliente/,
  // Manos mojadas / húmedas en la instalación.
  /manos?\s+(?:mojadas?|h[uú]medas?)/,
  // "la luz" es la forma COLOQUIAL de llamar a la alimentación: "trabaja con la luz
  // puesta", "cambia el enchufe con luz", "corta el cable con luz" (== energizado).
  //
  // ANTES ESTO ERA `/con.*luz/`: el `.*` sin anclaje casaba con CUALQUIER cosa entre
  // "con" y "luz", así que la guarda bloqueaba líneas de presupuesto corrientes:
  //   "hazme un presupuesto con 4 puntos de luz a 20 euros"
  //   "presupuesto con 2 puntos de luz y una hora de trabajo"
  // y "punto de luz" es pan de cada día para un electricista (es una partida del
  // propio catálogo, `catalogo-trabajos.ts`, y del REBT: C1/C6 "Puntos de luz").
  // El `.*` incumplía además la regla de este mismo fichero (líneas 32-36): todo
  // patrón va anclado a una palabra de ESTADO, nunca a algo que aparezca en
  // cualquier línea de presupuesto.
  //
  // Ahora la guarda exige una de las DOS formas en que se dice de verdad:
  //   (a) "con luz" SIN artículo — "corta el cable con luz" (== energizado). No
  //       puede confundirse con una ubicación ni con "puntos de luz".
  //   (b) "con la luz" + PALABRA DE ESTADO — "con la luz puesta/dada/conectada/
  //       encendida/enchufada". Es el mismo criterio que usa el resto del fichero.
  // Con esto, "con 4 puntos de luz" y "con la luz del pasillo" (una ubicación, no un
  // estado) dejan de bloquear un presupuesto, y ninguna forma real de decir
  // "trabajar con luz" se pierde.
  /con\s+luz\b/,
  /con\s+la\s+luz\s+(?:puesta|dada|conectada|enchufada|encendida|metida|en\s+el\s+cuadro)\b/,
  /manipular.*magnetot[eé]rmico.*sin/,
  /cambiar.*magnetot[eé]rmico.*sin/,
  /tocar.*cuadro.*sin/,
];

/**
 * Detecta si una pregunta implica trabajo con tensión o situación peligrosa.
 */
export function isDangerousElectricalQuery(query: string): boolean {
  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return LIVE_WORK_PATTERNS.some((patron) => patron.test(q));
}

/**
 * Respuesta de seguridad cuando se detecta una consulta peligrosa.
 */
export const DANGEROUS_QUERY_RESPONSE = `⚠️ **ADVERTENCIA DE SEGURIDAD**

No puedo dar instrucciones para trabajar con tensión. La electricidad puede causar **electrocución mortal, quemaduras graves e incendios**.

**Procedimiento seguro obligatorio (5 reglas de oro):**
1. Abrir el circuito (desconectar el interruptor general o el magnetotérmico del circuito)
2. Bloquear el elemento de corte para que nadie lo rearme
3. Verificar la ausencia de tensión con un comprobador VAT
4. Poner a tierra y en cortocircuito (en instalaciones de cierta potencia)
5. Delimitar la zona de trabajo

Si no tienes formación eléctrica profesional, contacta con un instalador autorizado.
Si es una emergencia (olor a quemado, chispas, humo), llama al 112 y corta la alimentación general desde un lugar seguro.`;
