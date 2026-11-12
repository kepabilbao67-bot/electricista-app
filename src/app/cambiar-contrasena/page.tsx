"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";

export default function CambiarContrasena() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newPassword !== repeat) { setMessage("Las contraseñas nuevas no coinciden."); return; }
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", cache: "no-store",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await r.json() as { message?: string; error?: string };
      setMessage(data.message || data.error || "No se pudo completar.");
      if (r.ok) { setCurrentPassword(""); setNewPassword(""); setRepeat(""); }
    } catch { setMessage("Error de conexión."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md p-6">
    <section className="rounded-2xl border border-sky-700 bg-slate-900 p-6 text-white">
      <h1 className="text-2xl font-bold">Cambiar contraseña</h1>
      <p className="my-3 text-sm text-slate-300">Necesitas tu contraseña actual. No se cambiará hasta que confirmes el formulario.</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">Contraseña actual
          <input required type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className="mt-2 w-full rounded-lg border p-3 text-black" />
        </label>
        <label className="block">Nueva contraseña (mínimo 12 caracteres)
          <input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="mt-2 w-full rounded-lg border p-3 text-black" />
        </label>
        <label className="block">Repetir nueva contraseña
          <input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={repeat} onChange={e=>setRepeat(e.target.value)} className="mt-2 w-full rounded-lg border p-3 text-black" />
        </label>
        <button disabled={busy} className="w-full rounded-lg bg-sky-600 p-3 font-semibold disabled:opacity-50">{busy ? "Comprobando…" : "Confirmar cambio"}</button>
        {message && <p role="status" className="text-sm text-sky-200">{message}</p>}
      </form>
      <Link href="/configuracion" className="mt-5 inline-block underline">Volver a configuración</Link>
    </section>
  </main>;
}
