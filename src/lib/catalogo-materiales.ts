/**
 * Catálogo configurable de materiales habituales para partes de trabajo.
 * Los precios se dejan en 0 para que el electricista los configure.
 * No se inventan marcas, referencias ni márgenes.
 */

export interface MaterialHabitual {
  id: string;
  nombre: string;
  descripcion: string;
  unidad: UnidadMaterial;
  precioVenta: number; // 0 = sin precio configurado
  precioCoste: number; // 0 = sin precio configurado
}

export type UnidadMaterial = "unidad" | "metro" | "rollo" | "caja" | "paquete";

export const UNIDADES_MATERIAL: { value: UnidadMaterial; label: string }[] = [
  { value: "unidad", label: "Unidad" },
  { value: "metro", label: "Metro" },
  { value: "rollo", label: "Rollo" },
  { value: "caja", label: "Caja" },
  { value: "paquete", label: "Paquete" },
];

export const CATALOGO_MATERIALES: MaterialHabitual[] = [
  {
    id: "mat_h01",
    nombre: "Cable eléctrico",
    descripcion: "Cable eléctrico para instalación.",
    unidad: "metro",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h02",
    nombre: "Tubo corrugado",
    descripcion: "Tubo corrugado flexible para canalización.",
    unidad: "metro",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h03",
    nombre: "Canaleta",
    descripcion: "Canaleta con tapa para instalación en superficie.",
    unidad: "metro",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h04",
    nombre: "Caja de mecanismos",
    descripcion: "Caja de empotrar para mecanismos eléctricos.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h05",
    nombre: "Caja de derivación",
    descripcion: "Caja de derivación o registro.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h06",
    nombre: "Enchufe",
    descripcion: "Base de enchufe schuko con toma de tierra.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h07",
    nombre: "Interruptor",
    descripcion: "Interruptor o conmutador.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h08",
    nombre: "Conmutador",
    descripcion: "Conmutador eléctrico.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h09",
    nombre: "Pulsador",
    descripcion: "Pulsador eléctrico.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h10",
    nombre: "Foco",
    descripcion: "Foco empotrable o de superficie.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h11",
    nombre: "Luminaria",
    descripcion: "Luminaria LED.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h12",
    nombre: "Bombilla o lámpara",
    descripcion: "Bombilla o lámpara LED.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h13",
    nombre: "Magnetotérmico",
    descripcion: "Interruptor automático magnetotérmico.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h14",
    nombre: "Diferencial",
    descripcion: "Interruptor diferencial.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h15",
    nombre: "Protector contra sobretensiones",
    descripcion: "Protector contra sobretensiones transitorias.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h16",
    nombre: "Cuadro eléctrico",
    descripcion: "Cuadro eléctrico de empotrar o superficie.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h17",
    nombre: "Regleta o borne de conexión",
    descripcion: "Regleta o borne para conexiones eléctricas.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h18",
    nombre: "Bridas",
    descripcion: "Bridas de nylon para sujeción de cables.",
    unidad: "paquete",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h19",
    nombre: "Tornillería y fijaciones",
    descripcion: "Tornillos, tacos y fijaciones diversas.",
    unidad: "paquete",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h20",
    nombre: "Material auxiliar",
    descripcion: "Material auxiliar diverso.",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
  {
    id: "mat_h21",
    nombre: "Material personalizado",
    descripcion: "",
    unidad: "unidad",
    precioVenta: 0,
    precioCoste: 0,
  },
];
