import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const full = process.argv.includes("--full");
const node = process.execPath;
const tsxCli = resolve(root, "node_modules/tsx/dist/cli.mjs");
const tscCli = resolve(root, "node_modules/typescript/bin/tsc");
const nextCli = resolve(root, "node_modules/next/dist/bin/next");

const required = [
  "src/app/luz360/page.tsx",
  "src/lib/luz360/calculation.ts",
  "src/lib/luz360/plugin.ts",
  "src/lib/luz360/heatmap.ts",
  "src/components/luz360/LuxHeatmap.tsx",
  "src/components/luz360/LuxReport.tsx",
  "src/components/luz360/PhoneLuxSensor.tsx",
  "android/app/src/main/java/com/electricista360/app/NativeLightSensor.java",
  "android/app/src/main/java/com/electricista360/app/MainActivity.java",
  "src/lib/__tests__/luz360.test.ts",
  "src/lib/__tests__/luz360-plugin.test.ts",
  "src/lib/__tests__/luz360-heatmap.test.ts",
  "node_modules/tsx/dist/cli.mjs",
  "node_modules/typescript/bin/tsc",
  "node_modules/next/dist/bin/next",
];

function fail(message) {
  console.error("[LUZ360][FAIL]", message);
  process.exit(1);
}

function run(label, args) {
  console.log(`[LUZ360][RUN] ${label}`);
  const result = spawnSync(node, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} terminó con código ${result.status}`);
  console.log(`[LUZ360][PASS] ${label}`);
}

for (const relative of required) {
  if (!existsSync(resolve(root, relative))) fail(`Falta ${relative}`);
}

const modules = readFileSync(resolve(root, "src/lib/core/modules.ts"), "utf8");
const config = readFileSync(resolve(root, "src/lib/verticals/electricista/config.ts"), "utf8");
const knowledge = readFileSync(resolve(root, "src/lib/assistant/app-knowledge.ts"), "utf8");
const page = readFileSync(resolve(root, "src/app/luz360/page.tsx"), "utf8");
const lightSensor = readFileSync(resolve(root, "android/app/src/main/java/com/electricista360/app/NativeLightSensor.java"), "utf8");
const mainActivity = readFileSync(resolve(root, "android/app/src/main/java/com/electricista360/app/MainActivity.java"), "utf8");
const nextConfig = readFileSync(resolve(root, "next.config.ts"), "utf8");

if (!modules.includes('href: "/luz360"')) fail("Luz360 no está registrado en navegación.");
if (!config.includes('"luz360"')) fail("Luz360 no está activo en la vertical electricista.");
if (!knowledge.includes('route: "/luz360"')) fail("El asistente no conoce Luz360.");
if (!page.includes('kind: "luz360-session"')) fail("La pantalla no persiste sesiones Luz360.");
if (!page.includes("<LuxHeatmap")) fail("La pantalla no integra el heatmap.");
if (!page.includes("<LuxReport")) fail("La pantalla no integra el informe.");
if (!lightSensor.includes("Sensor.TYPE_LIGHT")) fail("Falta el sensor de luz nativo Android.");
if (!mainActivity.includes('addJavascriptInterface(nativeLightSensor, "AndroidLightSensor")')) fail("Falta exponer AndroidLightSensor al WebView.");
if (!nextConfig.includes("ambient-light-sensor=(self)")) fail("Permissions-Policy no permite el sensor de luz en el propio origen.");

run("tests Luz360 + navegación", [
  tsxCli,
  "--test",
  "src/lib/__tests__/luz360.test.ts",
  "src/lib/__tests__/luz360-plugin.test.ts",
  "src/lib/__tests__/luz360-heatmap.test.ts",
  "src/lib/__tests__/navigation.test.ts",
]);
run("TypeScript", [tscCli, "--noEmit"]);

if (full) {
  run("build producción", [nextCli, "build"]);
}

console.log(`[LUZ360][PASS] Quality gate completo${full ? " + build" : ""}.`);
