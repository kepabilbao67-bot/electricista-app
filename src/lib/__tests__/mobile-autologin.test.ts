import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mobileAutologinPermitido, mobileAutologinTokenFromUserAgent } from "@/lib/auth/mobile-autologin";

const original = {
  E360_MOBILE_AUTOLOGIN: process.env.E360_MOBILE_AUTOLOGIN,
  E360_MOBILE_AUTOLOGIN_TOKEN: process.env.E360_MOBILE_AUTOLOGIN_TOKEN,
};

function setEnv(key: string, value: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}

afterEach(() => {
  setEnv("E360_MOBILE_AUTOLOGIN", original.E360_MOBILE_AUTOLOGIN);
  setEnv("E360_MOBILE_AUTOLOGIN_TOKEN", original.E360_MOBILE_AUTOLOGIN_TOKEN);
});

describe("APK passwordless temporal", () => {
  const token = "a".repeat(48);

  test("sin opt-in no concede acceso", () => {
    setEnv("E360_MOBILE_AUTOLOGIN", undefined);
    setEnv("E360_MOBILE_AUTOLOGIN_TOKEN", token);
    const request = new Request("https://app.example/", { headers: { "user-agent": `Mozilla/5.0 Electricista360App/${token}` } });
    assert.equal(mobileAutologinPermitido(request), false);
  });

  test("un navegador normal nunca coincide", () => {
    setEnv("E360_MOBILE_AUTOLOGIN", "1");
    setEnv("E360_MOBILE_AUTOLOGIN_TOKEN", token);
    const request = new Request("https://app.example/", { headers: { "user-agent": "Mozilla/5.0 Chrome/154" } });
    assert.equal(mobileAutologinPermitido(request), false);
  });

  test("la APK con token correcto coincide", () => {
    setEnv("E360_MOBILE_AUTOLOGIN", "1");
    setEnv("E360_MOBILE_AUTOLOGIN_TOKEN", token);
    const request = new Request("https://app.example/", { headers: { "user-agent": `Mozilla/5.0 Electricista360App/${token}` } });
    assert.equal(mobileAutologinPermitido(request), true);
  });

  test("token incorrecto o corto se rechaza", () => {
    setEnv("E360_MOBILE_AUTOLOGIN", "1");
    setEnv("E360_MOBILE_AUTOLOGIN_TOKEN", token);
    const bad = new Request("https://app.example/", { headers: { "user-agent": "Mozilla/5.0 Electricista360App/" + "b".repeat(48) } });
    assert.equal(mobileAutologinPermitido(bad), false);
    assert.equal(mobileAutologinTokenFromUserAgent("Electricista360App/corto"), null);
  });
});
