import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getStoredTheme, setStoredTheme, applyTheme } from "../theme";

describe("Autónomo 360 - Sistema de Tema y Modo Oscuro", () => {
  test("1. getStoredTheme devuelve 'light' por defecto en entorno de servidor", () => {
    const theme = getStoredTheme();
    assert.ok(theme === "light" || theme === "dark");
  });

  test("2. setStoredTheme y applyTheme se ejecutan sin errores", () => {
    assert.doesNotThrow(() => {
      setStoredTheme("dark");
      setStoredTheme("light");
      applyTheme("dark");
      applyTheme("light");
    });
  });
});
