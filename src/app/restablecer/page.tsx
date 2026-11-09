"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

export default function RestablecerPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const match = /^#token=([A-Za-z0-9_-]+)$/.exec(window.location.hash);
    if (match) {
      setToken(match[1]);
      window.history.replaceState(null, "", "/restablecer");
    }
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (token && password !== repeat) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/password-recovery", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token
          ? { action: "confirm", token, password }
          : { action: "request", email }),
        cache: "no-store",
      });
      const body = await res.json() as { error?: string; message?: string };
      setMessage(body.message || body.error || "No se pudo completar la solicitud.");
      if (res.ok && token) { setToken(""); setPassword(""); setRepeat(""); }
    } catch { setMessage("No se pudo conectar. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md p-6">
    <section className="rounded-2xl border border-sky-700 bg-slate-900 p-6 text-white">
      <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
      <p className="mt-2 text-sm text-slate-300">Electricista 360: usa el correo de recuperación autorizado. El enlace es válido durante 15 minutos.</p>
      <form className="mt-5 space-y-4" onSubmit={submit}>
        {token ? <>
          <label className="block">Nueva contraseña (mínimo 12 caracteres)
            <input type="password" autoComplete="new-password" required minLength={12} maxLength={128}
              value={password} onChange={e => setPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-500 bg-slate-950 p-3"/>
          </label>
          <label className="block">Repetir contraseña
            <input type="password" autoComplete="new-password" required minLength={12} maxLength={128}
              value={repeat} onChange={e => setRepeat(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-500 bg-slate-950 p-3"/>
          </label>
        </> : <label className="block">Correo de recuperación
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-500 bg-slate-950 p-3"/>
        </label>}
        <button disabled={busy} className="w-full rounded-xl bg-blue-600 p-3 font-semibold disabled:opacity-50">
          {busy ? "Procesando…" : token ? "Cambiar contraseña" : "Enviar enlace de recuperación"}
        </button>
        {message && <p role="status" className="text-sm text-sky-200">{message}</p>}
      </form>
      <Link className="mt-5 inline-block text-sm text-sky-300 underline" href="/acceso">Volver a iniciar sesión</Link>
    </section>
  </main>;
}
