/**
 * Validación compartida para POST y PUT de partes de trabajo.
 * Retorna null si la validación pasa, o un string con el mensaje de error.
 */

export interface PartePayload {
  cliente?: string;
  fecha?: string;
  tecnico?: string;
  horaInicio?: string;
  horaFin?: string;
  client_id?: string | null;
  direccion?: string;
  observaciones?: string;
  estado?: string;
  iva_rate?: number;
  descuento?: number;
  budget_id?: string | null;
  visit_id?: string | null;
  trabajos?: TrabajoPayload[];
  materiales?: MaterialPayload[];
}

export interface TrabajoPayload {
  nombre_trabajo?: string;
  hora?: string;
  descripcion?: string;
  cantidad?: string | number;
  unidad?: string;
  precio_unitario?: string | number;
  estado?: string;
}

export interface MaterialPayload {
  nombre_material?: string;
  referencia?: string;
  descripcion?: string;
  cantidad?: string | number;
  unidad?: string;
  precio_coste?: string | number;
  precio_unitario?: string | number;
}

function isValidNumber(val: unknown): boolean {
  if (val === undefined || val === null || val === "") return true; // optional
  const n = typeof val === "number" ? val : parseFloat(String(val));
  return !isNaN(n) && isFinite(n);
}

function toNum(val: unknown): number {
  if (val === undefined || val === null || val === "") return 0;
  return typeof val === "number" ? val : parseFloat(String(val)) || 0;
}

export function validatePartePayload(body: PartePayload): string | null {
  // Required fields
  if (!body.cliente || !body.cliente.trim()) {
    return "El cliente es obligatorio";
  }
  if (!body.fecha) {
    return "La fecha es obligatoria";
  }

  // IVA validation
  if (body.iva_rate !== undefined) {
    if (!isValidNumber(body.iva_rate)) return "El IVA no es un número válido";
    const iva = toNum(body.iva_rate);
    if (iva < 0 || iva > 100) return "El IVA debe estar entre 0 y 100";
  }

  // Calculate subtotals for descuento validation
  let subtotalTrabajos = 0;
  let subtotalMateriales = 0;

  // Validate trabajo lines
  if (Array.isArray(body.trabajos)) {
    for (let i = 0; i < body.trabajos.length; i++) {
      const t = body.trabajos[i];
      // Skip empty rows
      if (!t.descripcion?.trim() && !t.nombre_trabajo?.trim()) continue;

      if (!isValidNumber(t.cantidad)) return `Fila de trabajo ${i + 1}: cantidad no válida`;
      if (!isValidNumber(t.precio_unitario)) return `Fila de trabajo ${i + 1}: precio no válido`;

      const cant = toNum(t.cantidad);
      const precio = toNum(t.precio_unitario);

      if (cant < 0) return `Fila de trabajo ${i + 1}: la cantidad debe ser mayor o igual a 0`;
      // Precio unitario: entero >= 1 obligatorio en filas utilizadas
      const precioRaw = String(t.precio_unitario ?? "").trim();
      const precioNum = Number(precioRaw);
      if (precioRaw === "" || !Number.isFinite(precioNum) || !Number.isInteger(precioNum) || precioNum < 1) {
        return `Fila de trabajo ${i + 1}: el precio por unidad debe ser un número entero igual o superior a 1 €`;
      }

      subtotalTrabajos += cant * precioNum;
    }
  }

  // Validate material lines
  if (Array.isArray(body.materiales)) {
    for (let i = 0; i < body.materiales.length; i++) {
      const m = body.materiales[i];
      // Skip empty rows
      if (!m.descripcion?.trim() && !m.nombre_material?.trim()) continue;

      if (!isValidNumber(m.cantidad)) return `Fila de material ${i + 1}: cantidad no válida`;
      if (!isValidNumber(m.precio_unitario)) return `Fila de material ${i + 1}: precio de venta no válido`;
      if (!isValidNumber(m.precio_coste)) return `Fila de material ${i + 1}: precio de coste no válido`;

      const cant = toNum(m.cantidad);
      const precioCoste = toNum(m.precio_coste);

      if (cant < 0) return `Fila de material ${i + 1}: la cantidad debe ser mayor o igual a 0`;
      // Precio unitario de venta: entero >= 1 obligatorio en filas utilizadas
      const precioVentaRaw = String(m.precio_unitario ?? "").trim();
      const precioVentaNum = Number(precioVentaRaw);
      if (precioVentaRaw === "" || !Number.isFinite(precioVentaNum) || !Number.isInteger(precioVentaNum) || precioVentaNum < 1) {
        return `Fila de material ${i + 1}: el precio por unidad debe ser un número entero igual o superior a 1 €`;
      }
      if (precioCoste < 0) return `Fila de material ${i + 1}: el precio de coste debe ser mayor o igual a 0`;

      subtotalMateriales += cant * precioVentaNum;
    }
  }

  // Descuento validation
  if (body.descuento !== undefined) {
    if (!isValidNumber(body.descuento)) return "El descuento no es un número válido";
    const desc = toNum(body.descuento);
    if (desc < 0) return "El descuento debe ser mayor o igual a 0";
    const subtotal = subtotalTrabajos + subtotalMateriales;
    if (desc > subtotal) return "El descuento no puede superar el subtotal";
  }

  return null; // valid
}

/** Safely parse a number, returning 0 for invalid/NaN/Infinity */
export function safeNum(val: unknown): number {
  if (val === undefined || val === null || val === "") return 0;
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(n) || !isFinite(n)) return 0;
  return n;
}
