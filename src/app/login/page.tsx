/**
 * ELECTRICISTA360 — AUTH FASE 1 · Página de login del usuario final
 *
 * Esta es la ÚNICA página accesible sin sesión. Sustituye al diálogo Basic Auth
 * del navegador, que además nunca podría funcionar en la APK.
 *
 * No contiene ninguna credencial: el usuario teclea las suyas y el servidor las
 * verifica. La APK no lleva usuario, contraseña ni token incrustado.
 */

import { loadVerticalConfig } from "@/lib/core/vertical-loader";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Acceso",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const brand = loadVerticalConfig().brand;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#020617] px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700/80 bg-slate-950/60 p-6 shadow-xl backdrop-blur-md sm:p-8">
        <div className="mb-7 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white"
            style={{ backgroundColor: brand.themeColor }}
          >
            {brand.initials}
          </div>
          <h1 className="text-xl font-semibold text-slate-100">{brand.tradeName}</h1>
          <p className="mt-1 text-sm text-slate-400">Inicia sesión para continuar</p>
        </div>

        <LoginForm nextPath={params?.next ?? null} />

        <p className="mt-6 text-center text-xs text-slate-500">
          Sesión protegida por cookie segura. No se guardan credenciales en el dispositivo.
        </p>
      </div>
    </div>
  );
}
