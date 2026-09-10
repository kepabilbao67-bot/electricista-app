/**
 * Electricista360 — product loader.
 *
 * Esta aplicación es standalone: la identidad del producto no se selecciona
 * mediante variables de entorno. `APP_VERTICAL` se ignora deliberadamente
 * para evitar que un despliegue de Electricista360 arranque como otro negocio.
 *
 * Los contratos de `core` se mantienen porque son útiles para separar marca,
 * módulos y catálogo, pero la única configuración de runtime es electricista.
 */

import type { Vertical, VerticalConfig } from "./types";
import { electricistaConfig } from "../verticals/electricista/config";

/** Devuelve siempre la identidad única del producto standalone. */
export function getVertical(): Vertical {
  return "electricista";
}

/** Carga la única configuración permitida por Electricista360. */
export function loadVerticalConfig(): VerticalConfig {
  return electricistaConfig;
}
