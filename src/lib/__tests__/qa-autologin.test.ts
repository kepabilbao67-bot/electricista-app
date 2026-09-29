import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  QA_AUTOLOGIN_EMAIL_POR_DEFECTO,
  intentarSesionQa,
  qaAutologinEmail,
  qaAutologinPermitido,
} from "@/lib/auth/qa-autologin";

/**
 * ACCESO AUTOMÁTICO DE QA — GARANTÍAS
 *
 * El requisito que protege este archivo es de SEGURIDAD, no de comodidad:
 * el bypass de QA sirve para probar en el móvil sin teclear contraseña, y
 * PRODUCCIÓN TIENE QUE RECHAZARLO OBLIGATORIAMENTE, incluso si alguien deja la
 * variable de entorno puesta por descuido.
 */

const original = {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  E360_QA_AUTOLOGIN: process.env.E360_QA_AUTOLOGIN,
  E360_QA_EMAIL: process.env.E360_QA_EMAIL,
};

/**
 * `NODE_ENV` está declarado como solo-lectura en los tipos de Node, pero estos
 * tests necesitan simular los dos entornos. Se escribe a través de una vista
 * mutable de `process.env` (es lo mismo que hace el propio cargador de Node).
 */
function ponerEnv(clave: string, valor: string | undefined): void {
  const env = process.env as unknown as Record<string, string | undefined>;
  if (valor === undefined) delete env[clave];
  else env[clave] = valor;
}

function restaurar(): void {
  ponerEnv("NODE_ENV", original.NODE_ENV);
  ponerEnv("VERCEL_ENV", original.VERCEL_ENV);
  ponerEnv("E360_QA_AUTOLOGIN", original.E360_QA_AUTOLOGIN);
  ponerEnv("E360_QA_EMAIL", original.E360_QA_EMAIL);
}

afterEach(restaurar);

describe("Acceso automático de QA — solo desarrollo", () => {
  test("1. sin la variable explícita NO se habilita nada (comportamiento de antes)", () => {
    ponerEnv("E360_QA_AUTOLOGIN", undefined);
    ponerEnv("NODE_ENV", "development");
    assert.equal(qaAutologinPermitido(), false, "sin opt-in no puede abrirse la puerta");
  });

  test("2. en desarrollo, con la variable puesta, sí se permite", () => {
    ponerEnv("NODE_ENV", "development");
    ponerEnv("VERCEL_ENV", undefined);
    ponerEnv("E360_QA_AUTOLOGIN", "1");
    assert.equal(qaAutologinPermitido(), true);
  });

  test("3. PRODUCCIÓN RECHAZA el bypass aunque la variable esté puesta", () => {
    ponerEnv("E360_QA_AUTOLOGIN", "1");
    ponerEnv("NODE_ENV", "production");
    assert.equal(
      qaAutologinPermitido(),
      false,
      "con NODE_ENV=production no puede existir acceso sin contraseña NUNCA"
    );
  });

  test("4. un despliegue de producción de Vercel también lo rechaza", () => {
    ponerEnv("E360_QA_AUTOLOGIN", "1");
    ponerEnv("NODE_ENV", "development");
    ponerEnv("VERCEL_ENV", "production");
    assert.equal(qaAutologinPermitido(), false);
  });

  test("5. en producción NO se emite ninguna sesión automática (ni se toca la BD)", async () => {
    ponerEnv("E360_QA_AUTOLOGIN", "1");
    ponerEnv("NODE_ENV", "production");
    const sesion = await intentarSesionQa(new Request("https://app.electricista360.example/"));
    assert.equal(sesion, null, "en producción la función debe devolver null sin más");
  });

  test("6. el correo de QA es el de por defecto y se puede cambiar por entorno", () => {
    ponerEnv("E360_QA_EMAIL", undefined);
    assert.equal(qaAutologinEmail(), QA_AUTOLOGIN_EMAIL_POR_DEFECTO);
    ponerEnv("E360_QA_EMAIL", "otro.qa@local.test");
    assert.equal(qaAutologinEmail(), "otro.qa@local.test");
  });
});
