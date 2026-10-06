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
  "src/app/mediciones360/page.tsx",
  "src/app/api/measurements360/route.ts",
  "src/lib/autonomo360/measurements.ts",
  "src/lib/measurements360/store.ts",
  "src/lib/measurements360/work-context.ts",
  "src/lib/measurements360/validation.ts",
  "android/app/src/main/AndroidManifest.xml",
  "next.config.ts",
  "src/lib/__tests__/measurements.test.ts",
  "src/lib/__tests__/measurements-store.test.ts",
  "src/lib/__tests__/measurements-work-context.test.ts",
  "src/lib/__tests__/measurements360-validation.test.ts",
  "node_modules/tsx/dist/cli.mjs",
  "node_modules/typescript/bin/tsc",
  "node_modules/next/dist/bin/next",
];

function fail(message) {
  console.error("[MEDICIONES360][FAIL]", message);
  process.exit(1);
}

function run(label, args) {
  console.log(`[MEDICIONES360][RUN] ${label}`);
  const result = spawnSync(node, args, { cwd: root, stdio: "inherit", env: process.env });
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} terminó con código ${result.status}`);
  console.log(`[MEDICIONES360][PASS] ${label}`);
}

for (const relative of required) {
  if (!existsSync(resolve(root, relative))) fail(`Falta ${relative}`);
}

const modules = readFileSync(resolve(root, "src/lib/core/modules.ts"), "utf8");
const config = readFileSync(resolve(root, "src/lib/verticals/electricista/config.ts"), "utf8");
const page = readFileSync(resolve(root, "src/app/mediciones360/page.tsx"), "utf8");
const manifest = readFileSync(resolve(root, "android/app/src/main/AndroidManifest.xml"), "utf8");
const nextConfig = readFileSync(resolve(root, "next.config.ts"), "utf8");

if (!modules.includes('href: "/mediciones360"')) fail("Mediciones360 no está registrado en navegación.");
if (!config.includes('"measurements"')) fail("Mediciones360 no está activo en la vertical electricista.");
if (!page.includes('fetch("/api/measurements360"')) fail("La pantalla no persiste mediciones.");
if (!page.includes("validateCalculatorInput")) fail("Falta la validación de cálculo.");
if (!page.includes('capture="environment"')) fail("Falta la captura de cámara móvil.");
if (manifest.includes('android.permission.CAMERA')) fail("Mediciones360 usa captura externa: CAMERA no debe forzar un permiso runtime innecesario.");
if (!nextConfig.includes("camera=(self)")) fail("Permissions-Policy debe permitir una futura cámara directa del propio origen.");

run("tests Mediciones360", [
  tsxCli,
  "--test",
  "src/lib/__tests__/measurements.test.ts",
  "src/lib/__tests__/measurements-store.test.ts",
  "src/lib/__tests__/measurements-work-context.test.ts",
  "src/lib/__tests__/measurements360-validation.test.ts",
]);
run("TypeScript", [tscCli, "--noEmit"]);

if (full) run("build producción", [nextCli, "build"]);

console.log(`[MEDICIONES360][PASS] Quality gate completo${full ? " + build" : ""}.`);
