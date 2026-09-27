"use client";

/**
 * ELECTRICISTA360 — AUTH FASE 1 · Formulario de login
 *
 * IMPORTANTE (por qué existe esta página):
 * Capacitor no sobrescribe `onReceivedHttpAuthRequest`, así que un reto
 * `401 WWW-Authenticate: Basic` se CANCELA en silencio dentro del WebView de la
 * APK: no aparece ningún diálogo y la pantalla queda en blanco. Por eso el login
 * del usuario final tiene que ser una página HTML propia, no Basic Auth.
 *
 * NO se guarda nada en localStorage/sessionStorage: ni credenciales ni tokens.
 * La sesión vive en una cookie `HttpOnly` que JavaScript no puede leer.
 */

import { useState } from "react";

/** Solo se aceptan destinos internos: evita redirecciones abiertas. */
function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.startsWith("/login")) return "/";
  return raw;
}

export default function LoginForm({ nextPath }: { nextPath: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        // Navegación completa: la cookie ya está puesta y el servidor debe
        // volver a renderizar con la identidad nueva.
        window.location.href = safeNextPath(nextPath);
        return;
      }

      let message = "No se pudo iniciar sesión.";
      try {
        const data = await response.json();
        if (data && typeof data.error === "string") message = data.error;
      } catch {
        /* respuesta sin JSON: se usa el mensaje genérico */
      }
      setError(message);
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-slate-300">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="tu@correo.com"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-slate-300">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="••••••••"
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
