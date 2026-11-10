"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/session-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember }), cache: "no-store"
      });
      if (!response.ok) {
        setError(response.status === 401 ? "Usuario o contraseña incorrectos" : "No se ha podido iniciar sesión");
        return;
      }
      const next = params.get("next") || "/";
      router.replace(next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/");
      router.refresh();
    } catch { setError("No hay conexión con el servidor"); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md py-10">
    <section className="rounded-3xl border border-sky-600 bg-slate-900 p-7 text-white shadow-xl">
      <p className="text-sm font-bold text-sky-300">ELECTRICISTA 360</p>
      <h1 className="mt-2 text-3xl font-black">Entrar a mi aplicación</h1>
      <p className="mt-3 text-sm text-slate-300">Inicia sesión una vez para mantener el acceso en el móvil hasta 30 días.</p>
      <form className="mt-7 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-semibold">Usuario
          <input required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-500 bg-slate-950 px-4 py-3 text-white" />
        </label>
        <label className="block text-sm font-semibold">Contraseña
          <div className="mt-2 flex items-center gap-2">
            <input required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-500 bg-slate-950 px-4 py-3 text-white" />
            <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)} className="rounded-xl border border-slate-500 px-3 py-3 text-sm text-white">
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="h-4 w-4" />
          Recordar acceso en este dispositivo (30 días)
        </label>
        {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-sky-600 p-3 font-bold text-white disabled:opacity-50">
          {busy ? "Comprobando…" : "Entrar"}
        </button>
      </form>
    </section>
  </main>;
}
export default function AccesoPage() {
  return <Suspense fallback={<main className="p-8">Cargando acceso…</main>}><LoginForm /></Suspense>;
}
