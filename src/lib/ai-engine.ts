import { KNOWLEDGE_BASE } from "@/lib/ai-knowledge";

export interface CatalogItem {
  id: string;
  name: string;
  unit_price: number;
  cost_price: number;
  category: string;
}

/**
 * Motor de respuestas OFFLINE (sin conexion a un LLM).
 *
 * Se usa como respaldo cuando no hay una clave de IA configurada o cuando la
 * llamada al modelo falla. Combina normativa REBT, precios del catalogo del
 * usuario y la base de conocimiento del negocio.
 */
export function localAnswer(query: string, catalog: CatalogItem[]): string {
  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Secciones / cable / mm
  if (q.match(/secci[oó]n|cable|mm/)) {
    return `**Tabla de secciones de cable (ITC-BT-19):**

| Seccion | Intensidad max. | Uso tipico |
|---------|----------------|------------|
| 1.5 mm2 | 15A | Iluminacion (C1) |
| 2.5 mm2 | 21A | Tomas generales (C2), frigorifico (C5) |
| 4 mm2 | 27A | Lavadora, lavavajillas (C4) |
| 6 mm2 | 36A | Cocina/horno (C3), calefaccion |
| 10 mm2 | 50A | Derivacion individual |
| 16 mm2 | 66A | Acometidas |
| 25 mm2 | 84A | Lineas principales |

Cable tipo H07V-K para instalacion interior bajo tubo. Caida de tension maxima: 3% en iluminacion, 5% en fuerza.`;
  }

  // Magnetotermico / proteccion / diferencial
  if (q.match(/magnetot[eé]rmico|protecci[oó]n|diferencial/)) {
    return `**Protecciones por circuito (ITC-BT-22/25):**

| Circuito | Uso | PIA | Diferencial |
|----------|-----|-----|-------------|
| C1 | Iluminacion | 10A curva C | 30mA |
| C2 | Tomas generales | 16A curva C | 30mA |
| C3 | Cocina/horno | 25A curva C | 30mA |
| C4 | Lavadora/lavavajillas | 20A curva C | 30mA |
| C5 | Tomas bano/cocina | 16A curva C | 30mA |

- IGA: 25A (basica) o 40A (elevada)
- Diferencial 30mA OBLIGATORIO para todos los circuitos
- Poder de corte minimo: 4500A (recomendado 6000A)
- Se recomienda dividir en 2+ diferenciales para evitar corte total`;
  }

  // Circuitos / minimo / obligatorio
  if (q.match(/circuito|m[ií]nimo|obligatorio/)) {
    return `**Circuitos minimos obligatorios (ITC-BT-25):**

**Electrificacion BASICA** (5750W, IGA 25A):
- C1: Iluminacion - 1.5mm2, PIA 10A, max 30 puntos
- C2: Tomas generales - 2.5mm2, PIA 16A, max 20 tomas
- C3: Cocina y horno - 6mm2, PIA 25A, max 2 tomas
- C4: Lavadora/lavavajillas/termo - 4mm2, PIA 20A, max 3 tomas
- C5: Tomas bano y cocina - 2.5mm2, PIA 16A, max 6 tomas

**Electrificacion ELEVADA** (9200W, IGA 40A): C1-C5 + C6 a C12
- C6-C7: Iluminacion y tomas adicionales
- C8: Calefaccion (6mm2, 25A)
- C9: Aire acondicionado (6mm2, 25A)
- C10: Secadora (2.5mm2, 16A)
- C11: Automatizacion (1.5mm2, 10A)
- C12: Tomas adicionales cocina/bano (2.5mm2, 16A)`;
  }

  // Horno / vitro
  if (q.match(/horno|vitro|placa|inducci/)) {
    return `**Horno / Vitroceramica / Placa de induccion:**

- Circuito: C3 (Cocina y horno)
- Seccion cable: **6 mm2** (H07V-K 3x6 mm2)
- Proteccion: Magnetotermico **2x25A** curva C
- Diferencial: 30mA obligatorio
- Intensidad maxima: 36A
- Toma: Base 25A (2P+T) encastrada

Si la placa de induccion supera 5400W, considerar seccion de 10mm2 y magnetotermico de 32A.

Precio instalacion tipica: linea horno-vitro 102.50 EUR`;
  }

  // Lavadora / lavavajillas
  if (q.match(/lavadora|lavavajillas|secadora/)) {
    return `**Lavadora / Lavavajillas / Secadora:**

- Circuito: C4 (Lavadora, lavavajillas, termo)
- Seccion cable: **2.5 mm2** (H07V-K 3x2.5 mm2) o 4mm2 si circuito compartido
- Proteccion: Magnetotermico **2x20A** curva C
- Diferencial: 30mA obligatorio
- Intensidad maxima: 21A (2.5mm2) / 27A (4mm2)
- Max 3 tomas por circuito C4

Se recomienda circuito independiente para cada electrodomestico si la distancia supera 15m.

Precio instalacion tipica: linea lavadora/lavavajillas 75.50 EUR cada una`;
  }

  // Alumbrado / luz
  if (q.match(/alumbrado|luz|iluminaci|led|foco/)) {
    return `**Circuito de alumbrado / iluminacion (C1):**

- Seccion cable: **1.5 mm2** (H07V-K 3x1.5 mm2)
- Proteccion: Magnetotermico **2x10A** curva C
- Diferencial: 30mA obligatorio
- Max 30 puntos de luz por circuito
- Intensidad maxima: 15A

En electrificacion elevada se anade C6 (iluminacion adicional) con las mismas caracteristicas.

Precio instalacion tipica: linea alumbrado 68.50 EUR`;
  }

  // Enchufe / toma
  if (q.match(/enchufe|toma(?!r)/)) {
    return `**Tomas de corriente / Enchufes (C2):**

- Seccion cable: **2.5 mm2** (H07V-K 3x2.5 mm2)
- Proteccion: Magnetotermico **2x16A** curva C
- Diferencial: 30mA obligatorio
- Max 20 tomas por circuito
- Intensidad maxima: 21A
- Altura instalacion: 30cm del suelo (vivienda)

Tomas de cocina y bano van en C5 (mismo cable 2.5mm2, PIA 16A, max 6 tomas).

Precio instalacion tipica: enchufe 67.50 EUR`;
  }

  // Tierra
  if (q.match(/tierra|pica|puesta/)) {
    return `**Instalacion de puesta a tierra (ITC-BT-17):**

- Obligatoria en TODA instalacion electrica
- Resistencia maxima: tension contacto < 50V (24V locales humedos)
- Con diferencial 30mA: R tierra < 800 ohmios (recomendado)
- Formula: R = V / I = 50V / 0.03A = 1666 ohm (maximo teorico)

**Componentes:**
- Electrodo: pica acero-cobre minimo 2m
- Conductor tierra: 16mm2 cobre desnudo enterrado
- Conductor proteccion (amarillo-verde): en todos los circuitos
- Borne principal de tierra en cuadro general
- Equipotencialidad en banos (ITC-BT-27)

Medicion periodica cada 5 anos obligatoria.`;
  }

  // Derivacion / individual
  if (q.match(/derivaci[oó]n|individual/)) {
    return `**Derivacion individual (ITC-BT-10):**

Linea que conecta el contador con el cuadro general de la vivienda.

- Seccion minima: **6 mm2** en cobre
- Conductores: fase + neutro + proteccion + reserva
- Tubo protector por zonas comunes del edificio
- Cable tipo: RZ1-K (AS) 0.6/1kV

**Caidas de tension maximas:**
- Contadores centralizados: 1%
- Contadores individuales: 0.5%

**Diametros tubo segun seccion:**
- 6mm2: tubo 32mm
- 10mm2: tubo 32mm
- 16mm2: tubo 40mm
- 25mm2: tubo 50mm

Precio instalacion tipica: derivacion individual 475 EUR`;
  }

  // Electrificacion / basica / elevada
  if (q.match(/electrificaci[oó]n|b[aá]sica|elevada/)) {
    return `**Grados de electrificacion (ITC-BT-25):**

**BASICA** - Se aplica cuando:
- Viviendas < 160 m2
- Sin calefaccion electrica
- Sin aire acondicionado
- Sin automatizacion
- Potencia: 5750W | IGA: 25A | Circuitos: C1-C5

**ELEVADA** - Se aplica cuando:
- Viviendas > 160 m2
- Con calefaccion electrica
- Con aire acondicionado
- Con sistema de automatizacion
- Con secadora
- Potencia: 9200W | IGA: 40A | Circuitos: C1-C12

La eleccion determina el numero de circuitos, la potencia contratada y las protecciones del cuadro.`;
  }

  // Caida / tension
  if (q.match(/ca[ií]da|tensi[oó]n/)) {
    return `**Caida de tension (ITC-BT-19):**

**Limites maximos permitidos:**
- Iluminacion: **3%**
- Otros usos (fuerza): **5%**
- Derivacion individual: 1% (centralizado) / 0.5% (individual)

**Formula (monofasico):**
e(%) = (2 x L x I x cos(phi)) / (conductividad x S x V) x 100

Donde:
- L = longitud en metros
- I = intensidad en amperios
- cos(phi) = factor de potencia (0.8-1)
- conductividad Cu = 56 m/(ohm*mm2)
- S = seccion en mm2
- V = tension (230V monofasico)

**Ejemplo:** Cable 2.5mm2, 20m, 16A, cos=1:
e = (2x20x16x1) / (56x2.5x230) x 100 = 1.98% (OK, <5%)`;
  }

  // Precio / cobrar / compra / venta / margen / material
  if (q.match(/precio|cobrar|costar|vale|tarifa|cuesta|compra|venta|margen|material|catalogo|sokoel/)) {
    if (catalog.length === 0) {
      return `No he podido cargar el catalogo. Ve a la seccion Catalogo para ver tus precios de compra y venta.`;
    }

    // Buscar material específico en la pregunta
    const matchedItems = catalog.filter((item) => {
      const itemName = item.name.toLowerCase();
      return q.split(/\s+/).some((word) => word.length > 3 && itemName.includes(word));
    });

    if (matchedItems.length > 0 && matchedItems.length <= 5) {
      const table = matchedItems.map((item) => {
        const margin = item.cost_price > 0 ? Math.round(((item.unit_price - item.cost_price) / item.cost_price) * 100) : 0;
        const beneficio = item.unit_price - (item.cost_price || 0);
        return `- **${item.name}**: Compra ${item.cost_price || 0}€ → Venta ${item.unit_price}€ (margen ${margin}%, beneficio ${beneficio.toFixed(2)}€)`;
      }).join("\n");
      return `**Materiales encontrados:**\n\n${table}\n\nPara ver todo el catalogo con precios de compra/venta, ve a Catalogo. Para calcular precios personalizados, usa la Calculadora (Catalogo → Calculadora).`;
    }

    // Si pregunta por margen general
    if (q.match(/margen|beneficio|gano/)) {
      const itemsConCoste = catalog.filter((i) => i.cost_price > 0);
      if (itemsConCoste.length > 0) {
        const avgMargin = itemsConCoste.reduce((acc, i) => acc + ((i.unit_price - i.cost_price) / i.cost_price * 100), 0) / itemsConCoste.length;
        const table = itemsConCoste.slice(0, 8).map((item) => {
          const margin = Math.round(((item.unit_price - item.cost_price) / item.cost_price) * 100);
          return `| ${item.name} | ${item.cost_price}€ | ${item.unit_price}€ | ${margin}% |`;
        }).join("\n");
        return `**Tu margen de beneficio:**\n\nMargen medio: **${avgMargin.toFixed(0)}%**\n\n| Material | Compra | Venta | Margen |\n|----------|--------|-------|--------|\n${table}\n\nPara ajustar margenes, ve a Catalogo → Calculadora.`;
      }
    }

    // Lista general de precios
    const byCategory = catalog.reduce((acc, item) => {
      const cat = item.category || "Otros";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, CatalogItem[]>);

    let response = "**Tu catalogo de precios (compra → venta):**\n\n";
    for (const [cat, items] of Object.entries(byCategory)) {
      response += `**${cat}:**\n`;
      for (const item of items.slice(0, 5)) {
        const margin = item.cost_price > 0 ? ` (margen ${Math.round(((item.unit_price - item.cost_price) / item.cost_price) * 100)}%)` : "";
        response += `- ${item.name}: ${item.cost_price > 0 ? `${item.cost_price}€ →` : ""} **${item.unit_price}€**${margin}\n`;
      }
      response += "\n";
    }
    response += `Total items en catalogo: ${catalog.length}\nVe a **Catalogo** para editar precios o a **Calculadora** para calcular margenes.`;
    return response;
  }

  // ============ BASE DE CONOCIMIENTO AMPLIADA ============
  for (const topic of KNOWLEDGE_BASE) {
    if (topic.keywords.test(q)) {
      return topic.response;
    }
  }

  // Piso / vivienda / habitaciones
  if (q.match(/piso|vivienda|habitaci|chalet|local/)) {
    return `**Circuitos segun tipo de vivienda (ITC-BT-25):**

**Piso standard (2-3 hab):**
- Electrificacion basica: 5 circuitos (C1-C5)
- Potencia: 5750W | IGA: 25A
- 1 diferencial 30mA, 5 magnetotermicos

**Piso grande (4+ hab) o chalet:**
- Electrificacion elevada: hasta 12 circuitos (C1-C12)
- Potencia: 9200W | IGA: 40A
- 2+ diferenciales 30mA, 10+ magnetotermicos
- Circuitos adicionales: calefaccion, A/C, secadora

**Local comercial:**
- Segun ITC-BT-28 (locales publica concurrencia)
- Alumbrado de emergencia obligatorio
- Cuadro con cerradura
- Diferencial selectivo + instantaneos

Usa el boton "Generar presupuesto automatico" en la seccion de presupuestos para calcular automaticamente las estancias y materiales.`;
  }

  // Default
  return `No tengo informacion especifica sobre eso todavia. Puedo ayudarte con muchos temas, por ejemplo:

**Normativa tecnica (REBT):**
secciones de cable, protecciones, circuitos minimos, banos, piscinas, garajes, locales comerciales, obras, instalaciones agricolas, puesta a tierra, derivacion individual, caida de tension.

**Precios y negocio:**
tu catalogo de materiales, margenes de beneficio, como calcular presupuestos, IRPF y modelo 130, cuota de autonomo, clientes morosos, ayudas y subvenciones.

**Tramites:**
boletin electrico/CIE, inspecciones OCA, carnet de instalador (REI).

**Seguridad:**
EPIs, primeros auxilios ante accidente electrico, riesgo de arco electrico.

**Tecnologia:**
domotica KNX, cargadores de coche electrico, fotovoltaica y autoconsumo, eficiencia energetica.

**Averias:**
salta el diferencial, no hay luz, parpadeo de luces.

**Herramientas:**
que comprar, uso del multimetro.

Prueba a reformular tu pregunta o usa una de las sugerencias de abajo.`;
}

/**
 * Construye un texto compacto con el catalogo del usuario para pasarlo como
 * contexto al modelo de IA (precios de compra, venta y margen).
 */
export function buildCatalogContext(catalog: CatalogItem[]): string {
  if (!catalog || catalog.length === 0) {
    return "El usuario todavia no tiene materiales en su catalogo.";
  }
  const lines = catalog.map((item) => {
    const compra = item.cost_price || 0;
    const venta = item.unit_price || 0;
    const margen = compra > 0 ? Math.round(((venta - compra) / compra) * 100) : null;
    return `- ${item.name} (${item.category || "Otros"}): compra ${compra}€, venta ${venta}€${margen !== null ? `, margen ${margen}%` : ""}`;
  });
  return `Catalogo de materiales del usuario (compra en SOKOEL):\n${lines.join("\n")}`;
}
