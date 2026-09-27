"use client";

/**
 * ELECTRICISTA360 — AUTH FASE 1 · Botón de cerrar sesión
 *
 * Llama a POST /api/auth/logout, que REVOCA la sesión en la base de datos además
 * de borrar la cookie. Borrar solo la cookie no bastaría: el token seguiría siendo
 * válido para quien lo hubiera copiado.
 */

import { useState } from "react";
import { LogOut } from "lucide-react";

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* Aunque falle la red, se navega a /login: el gate rechazará el token. */
    }
    // Navegación completa para descartar cualquier estado en memoria.
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      title="Cerrar sesión"
      aria-label="Cerrar sesión"
      className={
        compact
          ? "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 disabled:opacity-60"
          : "flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-600 hover:text-slate-100 disabled:opacity-60"
      }
    >
      <LogOut size={16} />
      {compact ? null : <span>{busy ? "Saliendo…" : "Salir"}</span>}
    </button>
  );
}
