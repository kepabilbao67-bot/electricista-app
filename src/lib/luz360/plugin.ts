import type { LuxReading } from "./calculation";

export type Luz360MeasurementMethod =
  | "manual-luxmeter"
  | "phone-orientative"
  | "bluetooth-luxmeter";

export interface Luz360PluginContext {
  readings: LuxReading[];
  minLux: number;
  method: Luz360MeasurementMethod;
}

export interface Luz360PluginIssue {
  plugin: string;
  level: "ERROR" | "WARN";
  message: string;
}

export interface Luz360ValidationPlugin {
  id: string;
  validate(context: Luz360PluginContext): Luz360PluginIssue[];
}

const readingIntegrityPlugin: Luz360ValidationPlugin = {
  id: "reading-integrity",
  validate(context) {
    const issues: Luz360PluginIssue[] = [];
    if (context.readings.length === 0) {
      issues.push({
        plugin: this.id,
        level: "ERROR",
        message: "La sesión necesita al menos una lectura.",
      });
      return issues;
    }

    const ids = new Set<string>();
    for (const reading of context.readings) {
      if (!reading.id || ids.has(reading.id)) {
        issues.push({
          plugin: this.id,
          level: "ERROR",
          message: "Las lecturas necesitan identificadores únicos.",
        });
        break;
      }
      ids.add(reading.id);

      if (!Number.isFinite(reading.lux) || reading.lux < 0) {
        issues.push({
          plugin: this.id,
          level: "ERROR",
          message: "Hay una lectura de lux no válida.",
        });
        break;
      }

      if (
        (reading.x != null && (!Number.isFinite(reading.x) || reading.x < 0 || reading.x > 100)) ||
        (reading.y != null && (!Number.isFinite(reading.y) || reading.y < 0 || reading.y > 100))
      ) {
        issues.push({
          plugin: this.id,
          level: "ERROR",
          message: "Las coordenadas del mapa deben estar entre 0 y 100.",
        });
        break;
      }
    }
    return issues;
  },
};

const profileIntegrityPlugin: Luz360ValidationPlugin = {
  id: "profile-integrity",
  validate(context) {
    return Number.isFinite(context.minLux) && context.minLux > 0
      ? []
      : [{
          plugin: this.id,
          level: "ERROR",
          message: "El perfil necesita un objetivo mínimo de lux válido.",
        }];
  },
};

const sessionCoveragePlugin: Luz360ValidationPlugin = {
  id: "session-coverage",
  validate(context) {
    if (context.readings.length > 0 && context.readings.length < 4) {
      return [{
        plugin: this.id,
        level: "WARN",
        message: "Cobertura limitada: usa varios puntos repartidos por la estancia para que el resultado sea más representativo.",
      }];
    }
    return [];
  },
};

const professionalMethodPlugin: Luz360ValidationPlugin = {
  id: "measurement-method",
  validate(context) {
    if (context.method === "phone-orientative") {
      return [{
        plugin: this.id,
        level: "WARN",
        message: "La lectura del teléfono es orientativa y no sustituye un luxómetro calibrado.",
      }];
    }
    return [];
  },
};

export const LUZ360_VALIDATION_PLUGINS: readonly Luz360ValidationPlugin[] = [
  readingIntegrityPlugin,
  profileIntegrityPlugin,
  sessionCoveragePlugin,
  professionalMethodPlugin,
] as const;

export function runLuz360Plugins(
  context: Luz360PluginContext,
  plugins: readonly Luz360ValidationPlugin[] = LUZ360_VALIDATION_PLUGINS,
) {
  const issues = plugins.flatMap((plugin) => plugin.validate(context));
  const errors = issues.filter((issue) => issue.level === "ERROR");
  const warnings = issues.filter((issue) => issue.level === "WARN");
  return {
    ok: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}
