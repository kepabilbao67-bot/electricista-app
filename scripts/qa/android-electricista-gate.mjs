import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const androidDir = resolve(root, "android");
const isWindows = process.platform === "win32";
const gradle = resolve(androidDir, isWindows ? "gradlew.bat" : "gradlew");

function javaMajor(javaHome) {
  if (!javaHome) return null;
  const java = resolve(javaHome, "bin", isWindows ? "java.exe" : "java");
  if (!existsSync(java)) return null;
  const result = spawnSync(java, ["-version"], { encoding: "utf8" });
  const text = `${result.stderr || ""}\n${result.stdout || ""}`;
  const match = text.match(/version\s+"(\d+)/i);
  return match ? Number(match[1]) : null;
}

function candidates() {
  const values = [];
  if (process.env.JAVA_HOME) values.push(process.env.JAVA_HOME);
  if (isWindows) {
    values.push("C:\\Program Files\\Android\\Android Studio\\jbr");
    values.push("C:\\Program Files\\Eclipse Adoptium\\jdk-21");
  } else if (process.platform === "darwin") {
    values.push("/Applications/Android Studio.app/Contents/jbr/Contents/Home");
  }
  return [...new Set(values.filter(Boolean))];
}

const javaHome = candidates().find((candidate) => javaMajor(candidate) >= 21);
if (!javaHome) {
  console.error("[ANDROID][FAIL] Electricista360 necesita JDK 21 o superior.");
  console.error("[ANDROID][INFO] Define JAVA_HOME con JDK 21 o instala Android Studio con su JBR.");
  process.exit(1);
}

if (!existsSync(gradle)) {
  console.error("[ANDROID][FAIL] No se encontró Gradle wrapper en android/.");
  process.exit(1);
}

console.log(`[ANDROID][INFO] JDK ${javaMajor(javaHome)}: ${javaHome}`);
const args = [
  ":app:compileDebugJavaWithJavac",
  "--no-daemon",
  "--console=plain",
  `-Dorg.gradle.java.home=${javaHome}`,
];

const psQuote = (value) => String(value).replaceAll("'", "''");
const result = isWindows
  ? spawnSync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `& '${psQuote(gradle)}' '${psQuote(args[0])}' '${psQuote(args[1])}' '${psQuote(args[2])}' '${psQuote(args[3])}'`,
    ], {
      cwd: androidDir,
      stdio: "inherit",
      env: { ...process.env, JAVA_HOME: javaHome },
    })
  : spawnSync(gradle, args, {
      cwd: androidDir,
      stdio: "inherit",
      env: { ...process.env, JAVA_HOME: javaHome },
    });

if (result.error) {
  console.error(`[ANDROID][FAIL] ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`[ANDROID][FAIL] Gradle terminó con código ${result.status}`);
  process.exit(result.status ?? 1);
}

console.log("[ANDROID][PASS] Compilación Java Android Electricista360.");
