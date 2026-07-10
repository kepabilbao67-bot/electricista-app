/**
 * MAT-001 — Datos demo de materiales profesionales para Autonomo360
 *
 * Este archivo contiene una base inicial de materiales genericos orientativos
 * para el modulo de catalogo/presupuestos. Los precios son aproximados y no
 * representan datos reales de ningun proveedor concreto.
 *
 * No contiene datos personales, NIF, direcciones, IBAN ni informacion privada.
 */

export interface MaterialDemo {
  id: string;
  name: string;
  description: string;
  unit_price: number; // Precio venta al cliente (EUR sin IVA)
  cost_price: number; // Precio coste orientativo (EUR sin IVA)
  category: string;
}

export const CATEGORIAS_MATERIALES = [
  "Iluminacion",
  "Mecanismos",
  "Protecciones",
  "Cableado y canalizacion",
  "Instalacion especial",
  "Consumibles",
] as const;

export type CategoriaMaterial = (typeof CATEGORIAS_MATERIALES)[number];

export const MATERIALES_DEMO: MaterialDemo[] = [
  // ─── Iluminacion ────────────────────────────────────────────────────────────
  {
    id: "mat_001",
    name: "Downlight LED GU10",
    description: "Foco empotrable LED tipo downlight con casquillo GU10, acabado blanco",
    unit_price: 18.50,
    cost_price: 8.90,
    category: "Iluminacion",
  },
  {
    id: "mat_002",
    name: "Aro empotrable GU10",
    description: "Aro empotrable orientable para lampara GU10, color blanco",
    unit_price: 8.00,
    cost_price: 3.20,
    category: "Iluminacion",
  },
  {
    id: "mat_003",
    name: "Lampara LED GU10 7W",
    description: "Bombilla LED GU10 7W 4000K luz neutra, 600lm",
    unit_price: 6.50,
    cost_price: 2.85,
    category: "Iluminacion",
  },

  // ─── Mecanismos ─────────────────────────────────────────────────────────────
  {
    id: "mat_004",
    name: "Interruptor/conmutador blanco",
    description: "Interruptor o conmutador 10A 250V, serie basica color blanco",
    unit_price: 12.00,
    cost_price: 4.50,
    category: "Mecanismos",
  },
  {
    id: "mat_005",
    name: "Base schuko 16A",
    description: "Base de enchufe schuko 16A 250V con toma de tierra, color blanco",
    unit_price: 12.50,
    cost_price: 4.80,
    category: "Mecanismos",
  },
  {
    id: "mat_006",
    name: "Bastidor 1 elemento",
    description: "Bastidor o soporte para 1 mecanismo, compatible serie basica",
    unit_price: 3.50,
    cost_price: 1.20,
    category: "Mecanismos",
  },
  {
    id: "mat_007",
    name: "Marco 1 elemento",
    description: "Marco embellecedor para 1 mecanismo, color blanco",
    unit_price: 5.00,
    cost_price: 1.90,
    category: "Mecanismos",
  },
  {
    id: "mat_008",
    name: "Marco 2 elementos",
    description: "Marco embellecedor para 2 mecanismos, color blanco",
    unit_price: 7.50,
    cost_price: 3.10,
    category: "Mecanismos",
  },
  {
    id: "mat_009",
    name: "Marco 3 elementos",
    description: "Marco embellecedor para 3 mecanismos, color blanco",
    unit_price: 10.00,
    cost_price: 4.20,
    category: "Mecanismos",
  },
  {
    id: "mat_010",
    name: "Marco 4 elementos",
    description: "Marco embellecedor para 4 mecanismos, color blanco",
    unit_price: 12.50,
    cost_price: 5.40,
    category: "Mecanismos",
  },
  {
    id: "mat_011",
    name: "Tapa toma TV/SAT",
    description: "Tapa para toma de television y satelite, color blanco",
    unit_price: 9.00,
    cost_price: 3.60,
    category: "Mecanismos",
  },
  {
    id: "mat_012",
    name: "Tapa RJ45",
    description: "Tapa para toma de datos RJ45 cat.6, color blanco",
    unit_price: 10.50,
    cost_price: 4.10,
    category: "Mecanismos",
  },

  // ─── Protecciones ───────────────────────────────────────────────────────────
  {
    id: "mat_013",
    name: "Magnetotermico 2P 10A",
    description: "Interruptor automatico magnetotermico bipolar 10A curva C, carril DIN",
    unit_price: 34.50,
    cost_price: 14.80,
    category: "Protecciones",
  },
  {
    id: "mat_014",
    name: "Magnetotermico 2P 16A",
    description: "Interruptor automatico magnetotermico bipolar 16A curva C, carril DIN",
    unit_price: 36.50,
    cost_price: 15.60,
    category: "Protecciones",
  },
  {
    id: "mat_015",
    name: "Diferencial 2P 40A 30mA",
    description: "Interruptor diferencial bipolar 40A sensibilidad 30mA clase AC",
    unit_price: 65.00,
    cost_price: 28.50,
    category: "Protecciones",
  },
  {
    id: "mat_016",
    name: "Caja Practibox cuadro electrico",
    description: "Cuadro electrico de empotrar tipo Practibox, 24 modulos con puerta",
    unit_price: 85.00,
    cost_price: 38.00,
    category: "Protecciones",
  },

  // ─── Cableado y canalizacion ────────────────────────────────────────────────
  {
    id: "mat_017",
    name: "Cable RZ1-K 3G2.5",
    description: "Cable libre de halogenos RZ1-K 0,6/1kV 3x2,5mm2 (por metro)",
    unit_price: 3.20,
    cost_price: 1.45,
    category: "Cableado y canalizacion",
  },
  {
    id: "mat_018",
    name: "Cable RZ1-K 3G1.5",
    description: "Cable libre de halogenos RZ1-K 0,6/1kV 3x1,5mm2 (por metro)",
    unit_price: 2.50,
    cost_price: 1.10,
    category: "Cableado y canalizacion",
  },
  {
    id: "mat_019",
    name: "Tubo rigido M-20",
    description: "Tubo rigido liso PVC M-20 libre de halogenos (por metro)",
    unit_price: 2.80,
    cost_price: 1.05,
    category: "Cableado y canalizacion",
  },
  {
    id: "mat_020",
    name: "Manguito flexible M-20",
    description: "Tubo corrugado flexible M-20 libre de halogenos (por metro)",
    unit_price: 1.80,
    cost_price: 0.65,
    category: "Cableado y canalizacion",
  },
  {
    id: "mat_021",
    name: "Canaleta libre de halogenos",
    description: "Canaleta con tapa para superficie, 40x60mm libre de halogenos (por metro)",
    unit_price: 8.50,
    cost_price: 3.80,
    category: "Cableado y canalizacion",
  },

  // ─── Instalacion especial ───────────────────────────────────────────────────
  {
    id: "mat_022",
    name: "Terminal de acceso",
    description: "Terminal de control de acceso con lector de proximidad, montaje superficie",
    unit_price: 285.00,
    cost_price: 145.00,
    category: "Instalacion especial",
  },
  {
    id: "mat_023",
    name: "Ventilador de armario",
    description: "Ventilador con filtro para armario rack/cuadro, 230V 120x120mm",
    unit_price: 48.00,
    cost_price: 22.50,
    category: "Instalacion especial",
  },

  // ─── Consumibles ────────────────────────────────────────────────────────────
  {
    id: "mat_024",
    name: "Bridas nylon 200mm",
    description: "Bolsa de 100 bridas de nylon 3,6x200mm color blanco",
    unit_price: 4.50,
    cost_price: 1.80,
    category: "Consumibles",
  },
  {
    id: "mat_025",
    name: "Cinta aislante PVC",
    description: "Rollo de cinta aislante PVC 19mm x 20m, color negro",
    unit_price: 3.50,
    cost_price: 1.20,
    category: "Consumibles",
  },
];
