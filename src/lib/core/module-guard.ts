/**
 * AUTÓNOMO360 — Module Guard
 *
 * Verifica si un módulo está activo en la vertical actual.
 * Usado por layouts de ruta para bloquear acceso a módulos desactivados.
 *
 * Ejemplo de uso en un layout.tsx:
 *   import { guardModule } from "@/lib/core/module-guard";
 *   export default function Layout({ children }) {
 *     guardModule("normativa"); // notFound() si no está activo
 *     return <>{children}</>;
 *   }
 */

import { notFound } from "next/navigation";
import { loadVerticalConfig } from "./vertical-loader";
import type { ModuleId } from "./types";

/**
 * Si el módulo no está activo en la vertical actual, llama a notFound().
 * Si está activo, no hace nada (permite renderizar).
 */
export function guardModule(moduleId: ModuleId): void {
  const config = loadVerticalConfig();
  if (!config.modules.includes(moduleId)) {
    notFound();
  }
}
