// REBT Knowledge Base - Hardcoded data for ITC-BT regulations

export interface CircuitInfo {
  id: string;
  name: string;
  description: string;
  section: string; // mm2
  protection: string; // A
  maxPoints: number;
  conductor: string;
}

export interface CableSectionInfo {
  section: string;
  maxIntensity: number;
  typicalUse: string;
}

export const CABLE_SECTIONS: CableSectionInfo[] = [
  { section: "1.5 mm2", maxIntensity: 15, typicalUse: "Iluminacion (C1)" },
  { section: "2.5 mm2", maxIntensity: 21, typicalUse: "Tomas de corriente generales (C2), frigorificos (C5)" },
  { section: "4 mm2", maxIntensity: 27, typicalUse: "Cocina/horno (C3)" },
  { section: "6 mm2", maxIntensity: 36, typicalUse: "Cocina/horno alta potencia, calentador electrico (C4)" },
  { section: "10 mm2", maxIntensity: 50, typicalUse: "Derivacion individual, circuitos especiales" },
  { section: "16 mm2", maxIntensity: 66, typicalUse: "Derivacion individual alta potencia" },
  { section: "25 mm2", maxIntensity: 84, typicalUse: "Lineas principales, acometidas" },
];

export const CIRCUITS_BASIC: CircuitInfo[] = [
  { id: "C1", name: "C1 - Iluminacion", description: "Puntos de luz de la vivienda", section: "1.5", protection: "10A", maxPoints: 30, conductor: "H07V-K 3x1.5 mm2" },
  { id: "C2", name: "C2 - Tomas generales", description: "Tomas de corriente de uso general y frigorif.", section: "2.5", protection: "16A", maxPoints: 20, conductor: "H07V-K 3x2.5 mm2" },
  { id: "C3", name: "C3 - Cocina y horno", description: "Cocina electrica y horno", section: "6", protection: "25A", maxPoints: 2, conductor: "H07V-K 3x6 mm2" },
  { id: "C4", name: "C4 - Lavadora/lavavajillas/termo", description: "Lavadora, lavavajillas y termo electrico", section: "4", protection: "20A", maxPoints: 3, conductor: "H07V-K 3x4 mm2" },
  { id: "C5", name: "C5 - Bano y cocina", description: "Tomas de corriente de bano y cuarto de cocina", section: "2.5", protection: "16A", maxPoints: 6, conductor: "H07V-K 3x2.5 mm2" },
];

export const CIRCUITS_ELEVATED: CircuitInfo[] = [
  ...CIRCUITS_BASIC,
  { id: "C6", name: "C6 - Iluminacion adicional", description: "Puntos de luz adicionales", section: "1.5", protection: "10A", maxPoints: 30, conductor: "H07V-K 3x1.5 mm2" },
  { id: "C7", name: "C7 - Tomas adicionales", description: "Tomas de corriente adicionales", section: "2.5", protection: "16A", maxPoints: 20, conductor: "H07V-K 3x2.5 mm2" },
  { id: "C8", name: "C8 - Calefaccion", description: "Calefaccion electrica", section: "6", protection: "25A", maxPoints: 0, conductor: "H07V-K 3x6 mm2" },
  { id: "C9", name: "C9 - Aire acondicionado", description: "Instalacion de aire acondicionado", section: "6", protection: "25A", maxPoints: 0, conductor: "H07V-K 3x6 mm2" },
  { id: "C10", name: "C10 - Secadora", description: "Secadora independiente", section: "2.5", protection: "16A", maxPoints: 1, conductor: "H07V-K 3x2.5 mm2" },
  { id: "C11", name: "C11 - Automatizacion", description: "Sistema de automatizacion, gestion energia", section: "1.5", protection: "10A", maxPoints: 0, conductor: "H07V-K 3x1.5 mm2" },
  { id: "C12", name: "C12 - Tomas adicionales cocina/bano", description: "Tomas adicionales cocina y banos", section: "2.5", protection: "16A", maxPoints: 6, conductor: "H07V-K 3x2.5 mm2" },
];

export interface ITCInfo {
  code: string;
  title: string;
  summary: string;
  keyPoints: string[];
  keywords: string[];
}

export const ITC_DATABASE: ITCInfo[] = [
  {
    code: "ITC-BT-25",
    title: "Instalaciones interiores en viviendas - Numero de circuitos y caracteristicas",
    summary: "Define los circuitos minimos obligatorios para viviendas segun el grado de electrificacion (basica o elevada). Electrificacion basica: 5 circuitos (C1-C5), potencia 5750W. Electrificacion elevada: hasta 12 circuitos (C1-C12), potencia 9200W.",
    keyPoints: [
      "Electrificacion basica: 5750W, IGA 25A, 5 circuitos minimos (C1-C5)",
      "Electrificacion elevada: 9200W, IGA 40A, hasta 12 circuitos (C1-C12)",
      "Cada circuito con su propio magnetotermico y cableado independiente",
      "Diferencial 30mA obligatorio para todos los circuitos",
      "Caida de tension maxima del 3% en iluminacion y 5% en fuerza",
    ],
    keywords: ["circuitos", "vivienda", "electrificacion", "basica", "elevada", "minimos", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "magnetotermico", "circuito"],
  },
  {
    code: "ITC-BT-19",
    title: "Instalaciones interiores - Prescripciones generales (secciones de cable)",
    summary: "Establece las secciones minimas de los conductores segun la intensidad maxima admisible, tipo de instalacion y caida de tension. Tabla de secciones: 1.5mm2=15A, 2.5mm2=21A, 4mm2=27A, 6mm2=36A, 10mm2=50A.",
    keyPoints: [
      "1.5 mm2: intensidad maxima 15A (iluminacion)",
      "2.5 mm2: intensidad maxima 21A (tomas generales)",
      "4 mm2: intensidad maxima 27A (lavadora, lavavajillas)",
      "6 mm2: intensidad maxima 36A (cocina, horno, calefaccion)",
      "10 mm2: intensidad maxima 50A (derivacion individual)",
      "16 mm2: intensidad maxima 66A (acometidas)",
      "Caida de tension maxima: 3% iluminacion, 5% otros usos",
      "Cable tipo H07V-K para instalacion interior bajo tubo",
    ],
    keywords: ["seccion", "cable", "conductor", "mm2", "intensidad", "amperios", "caida", "tension", "horno", "cocina", "iluminacion", "lavadora", "toma"],
  },
  {
    code: "ITC-BT-22",
    title: "Proteccion contra sobreintensidades y cortocircuitos",
    summary: "Define las protecciones obligatorias: magnetotermicos (sobreintensidad), diferenciales (contacto indirecto). Cada circuito debe tener proteccion magnetotermica individual. Diferencial de 30mA obligatorio.",
    keyPoints: [
      "Magnetotermico individual por cada circuito",
      "Diferencial de sensibilidad 30mA (alta sensibilidad) obligatorio",
      "El diferencial protege contra contactos indirectos",
      "Poder de corte minimo 4500A (viviendas)",
      "IGA (Interruptor General Automatico): 25A basica, 40A elevada",
      "C1/C6 iluminacion: magnetotermico 10A",
      "C2/C7 tomas generales: magnetotermico 16A",
      "C3 cocina/horno: magnetotermico 25A",
      "C4 lavadora/lavavajillas: magnetotermico 20A",
      "C5 bano/cocina: magnetotermico 16A",
    ],
    keywords: ["magnetotermico", "diferencial", "proteccion", "IGA", "interruptor", "30mA", "sobreintensidad", "cortocircuito", "PIA", "automático"],
  },
  {
    code: "ITC-BT-10",
    title: "Derivacion individual",
    summary: "La derivacion individual es la linea que enlaza el contador con el cuadro general de la vivienda. Seccion minima 6mm2 en cobre. Debe ir por zonas comunes y en tubo o canal protector.",
    keyPoints: [
      "Seccion minima: 6 mm2 en cobre",
      "Conductores: fase, neutro, proteccion y reserva",
      "Debe ir por zonas comunes del edificio",
      "Tubo protector de diametro minimo segun seccion",
      "Caida de tension maxima: 1% para contadores centralizados, 0.5% individuales",
      "Instalacion bajo tubo empotrado o canal protector",
    ],
    keywords: ["derivacion", "individual", "contador", "cuadro", "linea", "acometida", "tubo"],
  },
  {
    code: "ITC-BT-17",
    title: "Instalaciones de puesta a tierra",
    summary: "Toda instalacion electrica debe disponer de toma de tierra. La resistencia de tierra debe ser tal que la tension de contacto no supere 24V en locales humedos y 50V en el resto.",
    keyPoints: [
      "Obligatoria en toda instalacion electrica",
      "Resistencia maxima: tension contacto < 50V (24V en locales humedos)",
      "Con diferencial 30mA: resistencia tierra < 800 ohmios",
      "Conductor de proteccion (amarillo-verde) en todos los circuitos",
      "Electrodos: picas de acero-cobre de 2m minimo",
      "Seccion minima conductor tierra: 16mm2 cobre desnudo enterrado",
      "Borne principal de tierra en cuadro general",
      "Equipotencialidad en banos (ITC-BT-27)",
    ],
    keywords: ["tierra", "puesta", "pica", "resistencia", "conductor", "proteccion", "equipotencial", "borne", "electrodo"],
  },
];

export interface KnowledgeEntry {
  keywords: string[];
  question_patterns: string[];
  answer: string;
}

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    keywords: ["seccion", "horno", "cocina", "placa"],
    question_patterns: ["seccion para horno", "seccion para cocina", "cable horno", "cable cocina", "placa induccion"],
    answer: "Segun ITC-BT-19 e ITC-BT-25, para horno y cocina electrica (circuito C3) se requiere cable de 6 mm2 (H07V-K 3x6 mm2) con proteccion magnetotermica de 25A. Intensidad maxima admisible: 36A. Si la cocina es de induccion de alta potencia (>5400W), considerar seccion de 10mm2.",
  },
  {
    keywords: ["seccion", "lavadora", "lavavajillas"],
    question_patterns: ["seccion para lavadora", "cable lavadora", "lavavajillas cable"],
    answer: "Segun ITC-BT-25, lavadora y lavavajillas van en circuito C4 con cable de 4 mm2 (H07V-K 3x4 mm2) y magnetotermico de 20A. Intensidad maxima admisible: 27A. Si se instalan independientes, cada uno con su circuito dedicado.",
  },
  {
    keywords: ["seccion", "iluminacion", "luz", "luces", "led"],
    question_patterns: ["seccion para iluminacion", "cable para luces", "seccion led"],
    answer: "Segun ITC-BT-25, el circuito de iluminacion (C1) usa cable de 1.5 mm2 (H07V-K 3x1.5 mm2) con magnetotermico de 10A. Maximo 30 puntos de luz por circuito. Intensidad maxima admisible: 15A.",
  },
  {
    keywords: ["seccion", "toma", "enchufe", "general"],
    question_patterns: ["seccion tomas", "cable enchufes", "tomas generales"],
    answer: "Segun ITC-BT-25, las tomas de corriente generales (C2) usan cable de 2.5 mm2 (H07V-K 3x2.5 mm2) con magnetotermico de 16A. Maximo 20 tomas por circuito. Intensidad maxima admisible: 21A.",
  },
  {
    keywords: ["circuitos", "minimos", "basica"],
    question_patterns: ["circuitos minimos basica", "electrificacion basica", "cuantos circuitos basica"],
    answer: "Electrificacion BASICA (ITC-BT-25): 5 circuitos minimos obligatorios:\n- C1: Iluminacion (1.5mm2, PIA 10A, max 30 puntos)\n- C2: Tomas generales (2.5mm2, PIA 16A, max 20 tomas)\n- C3: Cocina y horno (6mm2, PIA 25A, max 2 tomas)\n- C4: Lavadora/lavavajillas/termo (4mm2, PIA 20A, max 3 tomas)\n- C5: Tomas bano y cocina (2.5mm2, PIA 16A, max 6 tomas)\nPotencia prevista: 5750W. IGA: 25A.",
  },
  {
    keywords: ["circuitos", "minimos", "elevada"],
    question_patterns: ["circuitos minimos elevada", "electrificacion elevada", "cuantos circuitos elevada"],
    answer: "Electrificacion ELEVADA (ITC-BT-25): hasta 12 circuitos:\n- C1-C5: Igual que basica\n- C6: Iluminacion adicional (1.5mm2, PIA 10A)\n- C7: Tomas adicionales (2.5mm2, PIA 16A)\n- C8: Calefaccion (6mm2, PIA 25A)\n- C9: Aire acondicionado (6mm2, PIA 25A)\n- C10: Secadora (2.5mm2, PIA 16A)\n- C11: Automatizacion (1.5mm2, PIA 10A)\n- C12: Tomas adicionales cocina/bano (2.5mm2, PIA 16A)\nPotencia prevista: 9200W. IGA: 40A.",
  },
  {
    keywords: ["diferencial", "30", "sensibilidad"],
    question_patterns: ["diferencial obligatorio", "sensibilidad diferencial", "diferencial 30mA"],
    answer: "Segun ITC-BT-22 y ITC-BT-25, el diferencial de 30mA (alta sensibilidad) es OBLIGATORIO para todos los circuitos de vivienda. Protege contra contactos indirectos. Se recomienda dividir circuitos en 2 o mas diferenciales para evitar que un defecto deje sin corriente toda la vivienda. Poder de corte minimo: 4500A.",
  },
  {
    keywords: ["tierra", "pica", "resistencia"],
    question_patterns: ["resistencia tierra", "puesta a tierra", "pica de tierra", "valor tierra"],
    answer: "Segun ITC-BT-17: La resistencia de tierra debe garantizar tension de contacto < 50V (24V en locales humedos). Con diferencial de 30mA, la resistencia maxima de tierra es: R = 50V / 0.03A = 1666 ohmios (teorico), pero se recomienda R < 800 ohmios. Pica minima: acero-cobre 2m. Conductor tierra: minimo 16mm2 cobre desnudo enterrado.",
  },
  {
    keywords: ["derivacion", "individual", "contador"],
    question_patterns: ["derivacion individual", "linea contador", "seccion derivacion"],
    answer: "Segun ITC-BT-10: La derivacion individual conecta el contador con el cuadro general. Seccion minima: 6mm2 cobre. Conductores: fase + neutro + proteccion + reserva. Caida de tension maxima: 1% (contadores centralizados) o 0.5% (individuales). Debe ir en tubo protector por zonas comunes.",
  },
  {
    keywords: ["magnetotermico", "PIA", "interruptor", "automatico"],
    question_patterns: ["magnetotermico por circuito", "que magnetotermico", "PIA necesario"],
    answer: "Magnetotermicos por circuito (ITC-BT-22/25):\n- C1 Iluminacion: PIA 10A, curva C\n- C2 Tomas generales: PIA 16A, curva C\n- C3 Cocina/horno: PIA 25A, curva C\n- C4 Lavadora/lavavajillas: PIA 20A, curva C\n- C5 Tomas bano/cocina: PIA 16A, curva C\n- IGA: 25A (basica) o 40A (elevada)\nTodos con poder de corte minimo 4500A (6000A recomendado).",
  },
  {
    keywords: ["caida", "tension", "voltaje"],
    question_patterns: ["caida de tension", "caida tension maxima", "cuanto puede caer"],
    answer: "Segun ITC-BT-19, las caidas de tension maximas permitidas son:\n- Iluminacion: 3%\n- Otros usos (fuerza): 5%\n- Derivacion individual: 1% (centralizado) / 0.5% (individual)\nFormula: e = 2*L*I*cos(phi) / (conductividad*S) para monofasico.",
  },
  {
    keywords: ["bano", "volumen", "zona", "humedo"],
    question_patterns: ["instalacion bano", "volumenes bano", "zona humeda"],
    answer: "Segun ITC-BT-27, el bano se divide en volumenes:\n- Volumen 0: Interior banera/ducha. Nada electrico.\n- Volumen 1: Sobre banera/ducha hasta 2.25m. Solo IPX4, MBTS 12V.\n- Volumen 2: 0.6m alrededor vol.1. IPX4, luminarias clase II.\n- Volumen 3: 2.4m alrededor vol.2. Tomas con diferencial 30mA.\nConexion equipotencial suplementaria obligatoria uniendo tuberias metalicas, marcos, banera.",
  },
  {
    keywords: ["tubo", "diametro", "canalizacion"],
    question_patterns: ["diametro tubo", "que tubo", "canalizacion cables"],
    answer: "Segun ITC-BT-21, diametros minimos de tubo:\n- 1 cable de 1.5mm2: tubo 16mm\n- 1 cable de 2.5mm2: tubo 16mm\n- 1 cable de 4mm2: tubo 20mm\n- 1 cable de 6mm2: tubo 20mm\n- 1 cable de 10mm2: tubo 25mm\n- 2-3 cables de 2.5mm2: tubo 20mm\n- 2-3 cables de 4mm2: tubo 25mm\nRegla general: ocupacion maxima del 40% de la seccion del tubo.",
  },
];

export function searchKnowledge(query: string): string[] {
  const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 2);

  const results: { entry: KnowledgeEntry; score: number }[] = [];

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;

    // Check keyword matches
    for (const keyword of entry.keywords) {
      if (normalizedQuery.includes(keyword.toLowerCase())) {
        score += 3;
      }
      for (const word of queryWords) {
        if (keyword.toLowerCase().includes(word) || word.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
    }

    // Check pattern matches
    for (const pattern of entry.question_patterns) {
      const normalizedPattern = pattern.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedQuery.includes(normalizedPattern)) {
        score += 10;
      }
      const patternWords = normalizedPattern.split(/\s+/);
      const matchingWords = patternWords.filter((pw) =>
        queryWords.some((qw) => pw.includes(qw) || qw.includes(pw))
      );
      score += matchingWords.length * 2;
    }

    if (score > 0) {
      results.push({ entry, score });
    }
  }

  results.sort((a, b) => b.score - a.score);

  if (results.length === 0) {
    return ["No he encontrado informacion especifica para esa consulta. Prueba con terminos como: seccion, circuitos, magnetotermico, diferencial, tierra, derivacion, bano, horno, cocina, iluminacion."];
  }

  return results.slice(0, 3).map((r) => r.entry.answer);
}

export function validateBudgetItems(items: string[]): { valid: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Normalize items for matching
  const normalizedItems = items.map((i) => i.toLowerCase());
  const allText = normalizedItems.join(" ");

  // Check for mandatory circuits (basic electrification)
  const mandatoryChecks = [
    { name: "C1 - Iluminacion", keywords: ["iluminacion", "luz", "luminaria", "c1", "punto de luz"] },
    { name: "C2 - Tomas generales", keywords: ["toma general", "enchufe", "c2", "tomas de corriente"] },
    { name: "C3 - Cocina/horno", keywords: ["cocina", "horno", "placa", "c3", "vitroceramica", "induccion"] },
    { name: "C4 - Lavadora/lavavajillas", keywords: ["lavadora", "lavavajillas", "termo", "c4"] },
    { name: "C5 - Tomas bano/cocina", keywords: ["bano", "c5", "toma cocina", "toma bano"] },
  ];

  for (const check of mandatoryChecks) {
    const found = check.keywords.some((kw) => allText.includes(kw));
    if (!found) {
      missing.push(check.name);
    }
  }

  // Check for protections
  if (!allText.includes("diferencial") && !allText.includes("id ")) {
    warnings.push("No se detecta diferencial 30mA en el presupuesto");
  }
  if (!allText.includes("magnetotermico") && !allText.includes("pia") && !allText.includes("interruptor")) {
    warnings.push("No se detectan magnetotermicos/PIAs en el presupuesto");
  }
  if (!allText.includes("tierra") && !allText.includes("pica")) {
    warnings.push("No se detecta toma de tierra en el presupuesto");
  }
  if (!allText.includes("iga") && !allText.includes("interruptor general")) {
    warnings.push("No se detecta IGA (Interruptor General Automatico)");
  }

  return {
    valid: missing.length === 0 && warnings.length === 0,
    missing,
    warnings,
  };
}
