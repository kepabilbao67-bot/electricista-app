/**
 * Catálogo configurable de trabajos habituales para partes de trabajo.
 * El electricista puede personalizar nombres, descripciones, unidades y precios.
 * Los precios se dejan vacíos (0) para que el usuario los configure.
 */

export interface TrabajoHabitual {
  id: string;
  nombre: string;
  descripcion: string;
  unidad: UnidadTrabajo;
  precioUnitario: number; // 0 = sin precio configurado, el usuario lo introduce
}

export type UnidadTrabajo = "hora" | "unidad" | "metro" | "punto" | "servicio";

export const UNIDADES_TRABAJO: { value: UnidadTrabajo; label: string }[] = [
  { value: "hora", label: "Hora" },
  { value: "unidad", label: "Unidad" },
  { value: "metro", label: "Metro" },
  { value: "punto", label: "Punto" },
  { value: "servicio", label: "Servicio" },
];

export const CATALOGO_TRABAJOS: TrabajoHabitual[] = [
  {
    id: "trab_001",
    nombre: "Apertura o picado de rozas",
    descripcion: "Apertura de rozas para el paso y alojamiento de las canalizaciones eléctricas.",
    unidad: "metro",
    precioUnitario: 0,
  },
  {
    id: "trab_002",
    nombre: "Tapado básico de rozas",
    descripcion: "Tapado y acabado básico de rozas tras la instalación de canalizaciones.",
    unidad: "metro",
    precioUnitario: 0,
  },
  {
    id: "trab_003",
    nombre: "Colocación de tubo",
    descripcion: "Colocación y fijación de tubo para canalización de la instalación eléctrica.",
    unidad: "metro",
    precioUnitario: 0,
  },
  {
    id: "trab_004",
    nombre: "Tendido de cableado",
    descripcion: "Tendido, conexionado y comprobación del cableado eléctrico.",
    unidad: "metro",
    precioUnitario: 0,
  },
  {
    id: "trab_005",
    nombre: "Instalación de punto de luz",
    descripcion: "Instalación y comprobación de punto de luz.",
    unidad: "punto",
    precioUnitario: 0,
  },
  {
    id: "trab_006",
    nombre: "Instalación de foco",
    descripcion: "Instalación, conexionado y comprobación de foco.",
    unidad: "unidad",
    precioUnitario: 0,
  },
  {
    id: "trab_007",
    nombre: "Sustitución de foco",
    descripcion: "Sustitución de foco existente, conexionado y comprobación de funcionamiento.",
    unidad: "unidad",
    precioUnitario: 0,
  },
  {
    id: "trab_008",
    nombre: "Instalación de luminaria",
    descripcion: "Instalación, conexionado y comprobación de luminaria.",
    unidad: "unidad",
    precioUnitario: 0,
  },
  {
    id: "trab_009",
    nombre: "Instalación de enchufe",
    descripcion: "Instalación de base de enchufe, conexionado y comprobación.",
    unidad: "unidad",
    precioUnitario: 0,
  },
  {
    id: "trab_010",
    nombre: "Instalación de interruptor",
    descripcion: "Instalación de interruptor o conmutador, conexionado y comprobación.",
    unidad: "unidad",
    precioUnitario: 0,
  },
  {
    id: "trab_011",
    nombre: "Sustitución de mecanismo",
    descripcion: "Sustitución de mecanismo eléctrico existente y comprobación de funcionamiento.",
    unidad: "unidad",
    precioUnitario: 0,
  },
  {
    id: "trab_012",
    nombre: "Montaje de cuadro eléctrico",
    descripcion: "Montaje, cableado y comprobación de cuadro eléctrico.",
    unidad: "unidad",
    precioUnitario: 0,
  },
  {
    id: "trab_013",
    nombre: "Sustitución de protecciones",
    descripcion: "Sustitución de elementos de protección en cuadro eléctrico y comprobación.",
    unidad: "unidad",
    precioUnitario: 0,
  },
  {
    id: "trab_014",
    nombre: "Localización de avería",
    descripcion: "Comprobación de la instalación y localización de la causa de la avería eléctrica.",
    unidad: "servicio",
    precioUnitario: 0,
  },
  {
    id: "trab_015",
    nombre: "Reparación de avería",
    descripcion: "Reparación de avería eléctrica y comprobación final de funcionamiento.",
    unidad: "servicio",
    precioUnitario: 0,
  },
  {
    id: "trab_016",
    nombre: "Revisión de instalación",
    descripcion: "Revisión general de la instalación eléctrica y comprobación de funcionamiento.",
    unidad: "servicio",
    precioUnitario: 0,
  },
  {
    id: "trab_017",
    nombre: "Instalación de portero",
    descripcion: "Instalación y configuración de portero automático.",
    unidad: "unidad",
    precioUnitario: 0,
  },
  {
    id: "trab_018",
    nombre: "Instalación de videoportero",
    descripcion: "Instalación y configuración de videoportero.",
    unidad: "unidad",
    precioUnitario: 0,
  },
  {
    id: "trab_019",
    nombre: "Desplazamiento",
    descripcion: "Desplazamiento al lugar de trabajo.",
    unidad: "servicio",
    precioUnitario: 0,
  },
  {
    id: "trab_020",
    nombre: "Hora de oficial electricista",
    descripcion: "Hora de trabajo de oficial electricista.",
    unidad: "hora",
    precioUnitario: 0,
  },
  {
    id: "trab_021",
    nombre: "Hora de ayudante",
    descripcion: "Hora de trabajo de ayudante de electricista.",
    unidad: "hora",
    precioUnitario: 0,
  },
  {
    id: "trab_022",
    nombre: "Trabajo personalizado",
    descripcion: "",
    unidad: "unidad",
    precioUnitario: 0,
  },
];
