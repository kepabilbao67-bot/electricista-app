# AUTÓNOMO360 — ARQUITECTURA DEL NÚCLEO COMÚN

Fecha: 2026-08-07 | Rol: Arquitecto Principal + Product Owner
Documento de referencia para cualquier sesión de implementación.

---

## 1. RESUMEN EJECUTIVO

Autónomo360 necesita un núcleo común (`core`) que permita lanzar verticales como Electricista360, Kepa360 (tecnología), Luz360 (iluminación), Pintor360, Administrador360, etc., sin duplicar código y sin romper lo existente.

Este documento define:
- Qué es core vs. qué es vertical
- Cómo se conectan las verticales al core
- Qué archivos cambiarían
- En qué orden implementar
- Qué riesgos existen

**Principio rector:** el core define CONTRATOS; las verticales aportan CONTENIDO.

---

## 2. MAPA DE ACOPLAMIENTOS ACTUALES

### Archivos con datos de S&H Eléctricas (acoplamiento directo):

| Archivo | Tipo de acoplamiento | Severidad |
|---------|---------------------|-----------|
| `src/lib/company-profile.ts` | NIF, nombre, dirección hardcoded | CRÍTICO |
| `src/lib/catalogo-materiales.ts` | Materiales eléctricos | ALTO |
| `src/lib/catalogo-trabajos.ts` | Trabajos eléctricos (rozas, diferenciales) | ALTO |
| `src/lib/materiales-demo.ts` | Seed data eléctrico | ALTO |
| `src/lib/ai-knowledge.ts` | Conocimiento REBT/eléctrico | MEDIO |
| `src/lib/ai-engine.ts` | Respuestas REBT hardcoded | MEDIO |
| `src/lib/rebt-data.ts` | Normativa eléctrica | MEDIO |
| `src/lib/assistant/electrical-safety.ts` | Seguridad eléctrica | MEDIO |
| `src/lib/assistant/system-prompt.ts` | Prompt menciona electricista | BAJO |
| `src/lib/ticketbai/` | Fiscal solo Bizkaia | BAJO (opcional) |
| `public/manifest.json` | Nombre "S&H Eléctricas" | BAJO |
| `public/logo-sh-electricas.png` | Logo cliente | BAJO |

### Archivos 100% genéricos (ya son core):

| Archivo | Función |
|---------|---------|
| `src/lib/db.ts` | Init DB, migraciones, generadores número |
| `src/lib/crm.ts` | Stages pipeline (genérico para servicios) |
| `src/lib/templates.ts` | Plantillas mensajes con fillTemplate() |
| `src/lib/autocorrect-es.ts` | Autocorrección español |
| `src/lib/text-colors.ts` | Sistema de colores |
| `src/lib/sensitive-text-filter.ts` | Filtro datos sensibles |
| `src/lib/export-guard.ts` | Protección exportación |
| `src/lib/normalize-unit-price.ts` | Normalización precios |
| `src/lib/validate-parte.ts` | Validación partes trabajo |
| `src/lib/phone.ts` | Formateo teléfono |
| `src/lib/autonomo360/*.ts` | Fundaciones (intent, measurements, email, signature) |
| `src/components/Toast.tsx` | Notificaciones |
| `src/components/ColorSelect.tsx` | Selector colores |
| `src/components/Breadcrumbs.tsx` | Navegación |
| `middleware.ts` | Auth global |
| Todas las APIs (budgets, invoices, clients, etc.) | CRUD genérico |

---

## 3. DISEÑO DEL NÚCLEO COMÚN

### Estructura propuesta:

```
src/lib/
├── core/                          ← NÚCLEO COMÚN (nuevo directorio)
│   ├── types.ts                   ← Tipos compartidos: Company, Vertical, Module, CatalogItem
│   ├── company.ts                 ← Interface CompanyProfile + loader (env/DB/fallback)
│   ├── modules.ts                 ← Registry de módulos activables/desactivables
│   ├── catalog.ts                 ← Interface CatalogProvider (contratos, no datos)
│   ├── templates.ts               ← (mover desde lib/templates.ts)
│   ├── crm.ts                     ← (mover desde lib/crm.ts, ya genérico)
│   └── vertical.ts                ← (consolidar desde worktree kepa360)
├── verticals/                     ← CONTENIDO POR VERTICAL
│   ├── electricista/
│   │   ├── catalog.ts             ← CATALOGO_MATERIALES + CATALOGO_TRABAJOS
│   │   ├── knowledge.ts           ← REBT, ai-knowledge eléctrico
│   │   ├── safety.ts              ← electrical-safety
│   │   └── config.ts              ← Branding, módulos activos, unidades específicas
│   ├── tecnologia/
│   │   ├── catalog.ts             ← 8 servicios Kepa360
│   │   ├── knowledge.ts           ← Conocimiento tech
│   │   └── config.ts              ← Branding Kepa360
│   └── index.ts                   ← getVerticalConfig(vertical) → factory
├── autonomo360/                   ← (ya existe: intent, measurements, email, signature)
└── [archivos existentes se mantienen durante migración]
```

### Contratos del Core:

```typescript
// src/lib/core/types.ts

export type Vertical = "electricista" | "tecnologia" | "pintor" | "administrador" | string;

export interface CompanyProfile {
  tradeName: string;
  legalName: string;
  ownerName: string;
  nif: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  email: string;
  logo?: string;
}

export interface VerticalConfig {
  id: Vertical;
  brand: VerticalBrand;
  modules: ModuleId[];
  catalog: CatalogProvider;
  knowledge?: KnowledgeProvider;
}

export interface VerticalBrand {
  tradeName: string;
  shortName: string;
  description: string;
  themeColor: string;
  iconKey: string;
  initials: string;
}

export type ModuleId =
  | "dashboard" | "clients" | "crm" | "leads"
  | "invoices" | "budgets" | "work_orders" | "expenses"
  | "schedule" | "catalog" | "communications"
  | "normativa" | "export" | "assistant"
  | "measurements" | "signatures" | "email";

export interface CatalogProvider {
  getItems(): CatalogItem[];
  getCategories(): string[];
  getUnits(): { value: string; label: string }[];
}

export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  unit: string;
  unitPrice: number;
  costPrice: number;
  category: string;
}

export interface KnowledgeProvider {
  getTopics(): string[];
  answer(query: string, catalog: CatalogItem[]): string | null;
  getSuggestionChips(): string[];
}
```

### Cómo conecta una nueva vertical:

```typescript
// src/lib/verticals/pintor/config.ts (ejemplo futuro)
import type { VerticalConfig } from "../core/types";
import { catalogoPintor } from "./catalog";
import { knowledgePintor } from "./knowledge";

export const pintorConfig: VerticalConfig = {
  id: "pintor",
  brand: {
    tradeName: "Pintor360",
    shortName: "Pintor360",
    description: "Gestión profesional para pintores",
    themeColor: "#7c3aed",
    iconKey: "paintbrush",
    initials: "P3",
  },
  modules: [
    "dashboard", "clients", "crm", "leads",
    "invoices", "budgets", "work_orders", "expenses",
    "schedule", "catalog", "communications", "export", "assistant",
  ],
  catalog: catalogoPintor,
  knowledge: knowledgePintor,
};
```

---

## 4. REGLAS DE PERTENENCIA

| Pertenece a CORE si... | Pertenece a VERTICAL si... |
|------------------------|---------------------------|
| Funciona para cualquier autónomo | Menciona un oficio específico |
| No contiene datos de un sector | Contiene catálogos de un sector |
| Define interfaces/contratos | Implementa contenido específico |
| Es infraestructura (DB, auth, UI) | Es normativa sectorial |
| Es lógica financiera genérica (IVA, totales) | Es lógica fiscal territorial (TicketBAI) |

### Tabla de decisión para cada archivo actual:

| Archivo actual | Destino | Acción |
|---|---|---|
| company-profile.ts | core/company.ts | Refactorizar: interface + loader |
| crm.ts | core/crm.ts | Mover (ya es genérico) |
| templates.ts | core/templates.ts | Mover (ya es genérico) |
| db.ts | MANTENER en lib/ | Ya es core, no mover (rompe imports) |
| catalogo-materiales.ts | verticals/electricista/catalog.ts | Mover |
| catalogo-trabajos.ts | verticals/electricista/catalog.ts | Mover (merge) |
| materiales-demo.ts | verticals/electricista/seed.ts | Mover |
| ai-knowledge.ts | verticals/electricista/knowledge.ts | Mover |
| ai-engine.ts | MANTENER + inyectar KnowledgeProvider | Refactorizar |
| rebt-data.ts | verticals/electricista/rebt.ts | Mover |
| electrical-safety.ts | verticals/electricista/safety.ts | Mover |
| ticketbai/ | verticals/electricista/fiscal/ | Mover (o mantener como módulo opcional) |
| autonomo360/*.ts | MANTENER | Ya es core por diseño |

---

## 5. DEUDA TÉCNICA DETECTADA

| # | Problema | Impacto | Esfuerzo fix |
|---|---------|---------|-------------|
| 1 | company-profile.ts hardcoded | Bloquea multi-cliente | Bajo |
| 2 | Catálogos importados directamente en componentes | Bloquea vertical switch | Medio |
| 3 | ai-engine.ts mezcla REBT en función genérica | Impide reutilizar motor IA | Medio |
| 4 | Sidebar/MobileNav navItems hardcoded | Impide módulos configurables | Bajo |
| 5 | manifest.json estático | Impide PWA multi-marca | Bajo |
| 6 | Line endings mixtos (LF/CRLF) | Diffs sucios | Trivial |
| 7 | ensureColumns() en cada request | Performance en cold start | Bajo |
| 8 | Sin índice en catalog_items.category | Slow queries cuando crezca | Trivial |
| 9 | Trabajo sin commit (CRM + Asistente + fundaciones) | Riesgo de pérdida | Nulo (solo commit) |
| 10 | Worktree kepa360 desconectado | Duplicación potencial | Bajo |

---

## 6. DECISIONES ARQUITECTÓNICAS

| Decisión | Alternativa descartada | Justificación |
|----------|----------------------|---------------|
| Un solo repo con carpeta verticals/ | Monorepo con packages | Evita tooling complejo (turborepo, nx) en esta fase |
| Vertical como config, no como app separada | Apps separadas | Reutiliza 100% del código de rutas/API |
| APP_VERTICAL en env (servidor) | DB config | Inmutable por despliegue, sin query extra |
| CompanyProfile desde env → DB → fallback | Solo env | Permite panel de config futuro sin cambiar arch |
| Módulos como array de IDs | Feature flags complejos | Simple, tipado, extensible |
| CatalogProvider como interface | Catálogo único en DB | Permite seed inicial + override en DB después |
| TicketBAI como módulo opcional | Obligatorio para todos | Solo aplica en Bizkaia |

---

## 7. COMPATIBILIDAD CON ELECTRICISTA360

**Garantías:**

1. Sin APP_VERTICAL o APP_VERTICAL="electricista" → comportamiento IDÉNTICO al actual.
2. Todos los imports existentes siguen funcionando (re-exports desde ubicaciones originales durante migración).
3. Los 142 tests existentes deben pasar sin modificación.
4. El esquema DB no cambia.
5. La UI no cambia visualmente para electricista.
6. TicketBAI sigue funcionando exactamente igual.

**Estrategia de migración sin rotura:**

```
Fase 1: Crear core/types.ts + core/company.ts (interface + loader)
         company-profile.ts → re-export desde core (backward compatible)

Fase 2: Crear verticals/electricista/config.ts
         Mover catálogos a verticals/electricista/catalog.ts
         Re-export desde ubicaciones originales

Fase 3: Refactorizar Sidebar/MobileNav para leer modules desde config
         Mantener navItems actual como default

Fase 4: ai-engine.ts acepta KnowledgeProvider inyectado
         Mover REBT a verticals/electricista/knowledge.ts
```

Cada fase es un commit independiente. Si algo falla, se revierte solo esa fase.

---

## 8. ARCHIVOS QUE SE MODIFICARÍAN (futuro, sin tocar ahora)

### Fase 1 — Core types + Company (5 archivos):

| Archivo | Acción |
|---------|--------|
| `src/lib/core/types.ts` | CREAR |
| `src/lib/core/company.ts` | CREAR |
| `src/lib/core/modules.ts` | CREAR |
| `src/lib/company-profile.ts` | MODIFICAR (re-export desde core) |
| Tests nuevos | CREAR |

### Fase 2 — Verticals (8 archivos):

| Archivo | Acción |
|---------|--------|
| `src/lib/verticals/electricista/config.ts` | CREAR |
| `src/lib/verticals/electricista/catalog.ts` | CREAR (merge materiales + trabajos) |
| `src/lib/verticals/electricista/knowledge.ts` | CREAR (mover ai-knowledge) |
| `src/lib/verticals/electricista/safety.ts` | CREAR (mover electrical-safety) |
| `src/lib/verticals/index.ts` | CREAR (factory) |
| `src/lib/catalogo-materiales.ts` | MODIFICAR (re-export) |
| `src/lib/catalogo-trabajos.ts` | MODIFICAR (re-export) |
| `src/lib/ai-knowledge.ts` | MODIFICAR (re-export) |

### Fase 3 — Navigation (4 archivos):

| Archivo | Acción |
|---------|--------|
| `src/lib/core/navigation.ts` | CREAR (navItems por módulos activos) |
| `src/components/Sidebar.tsx` | MODIFICAR (leer config) |
| `src/components/MobileNav.tsx` | MODIFICAR (leer config) |
| `src/app/layout.tsx` | MODIFICAR (pasar config) |

### Fase 4 — AI refactor (3 archivos):

| Archivo | Acción |
|---------|--------|
| `src/lib/ai-engine.ts` | MODIFICAR (inyectar knowledge) |
| `src/lib/assistant/system-prompt.ts` | MODIFICAR (parametrizar sector) |
| `src/app/normativa/page.tsx` | MODIFICAR (usar provider) |

**Total: ~20 archivos en 4 fases incrementales.**

---

## 9. CÓMO AÑADIR UNA NUEVA VERTICAL (receta)

```bash
# 1. Crear configuración
src/lib/verticals/pintor/config.ts     ← brand + módulos activos
src/lib/verticals/pintor/catalog.ts    ← CatalogProvider con items del oficio
src/lib/verticals/pintor/knowledge.ts  ← (opcional) respuestas offline sectoriales

# 2. Registrar en factory
src/lib/verticals/index.ts             ← añadir case "pintor": return pintorConfig

# 3. Desplegar
APP_VERTICAL=pintor                    ← env var en Vercel/hosting
TURSO_DATABASE_URL=...                 ← DB separada
APP_BASIC_AUTH_USER=...                ← Credenciales propias

# 4. Resultado
- Dashboard muestra "Pintor360"
- Sidebar muestra solo módulos activados
- Catálogo tiene items de pintura
- Normativa usa knowledge de pintor (o se oculta si no tiene)
- Mismo código, mismo deploy pipeline, datos separados
```

---

## 10. RIESGOS

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Refactor rompe tests existentes | Baja | Alto | Re-exports mantienen backward compat |
| Catálogos en verticals/ no encontrados en imports viejos | Media | Medio | Re-export obligatorio durante 1 versión |
| ai-engine.ts es complejo de refactorizar | Media | Medio | Hacer en última fase, con tests |
| Vertical nueva sin knowledge → normativa vacía | Segura | Bajo | Ocultar módulo si no hay KnowledgeProvider |
| APP_VERTICAL mal configurada | Baja | Alto | Validación estricta con error explícito (ya implementada en worktree) |
| Performance: cargar vertical config en cada request | Baja | Bajo | Config es estática, se resuelve en build time |

---

## 11. PRÓXIMO SPRINT RECOMENDADO

**Sprint: "Core Foundation" — 4 bloques incrementales**

| # | Bloque | Valor | Esfuerzo | Prioridad |
|---|--------|-------|----------|-----------|
| 1 | Commitear todo el trabajo pendiente (CRM + Asistente + fundaciones) | Proteger trabajo | Nulo | INMEDIATO |
| 2 | Crear `src/lib/core/` (types, company, modules) | Desbloquea multi-vertical | Bajo | P1 |
| 3 | Crear `src/lib/verticals/electricista/` (mover catálogos y knowledge) | Desacopla sector | Medio | P1 |
| 4 | Integrar vertical.ts del worktree kepa360 → consolidar en core | Unifica configuración | Bajo | P2 |
| 5 | Refactorizar Sidebar/MobileNav para módulos dinámicos | UX multi-vertical | Bajo | P2 |

**Pre-requisito:** autorización para hacer commit del trabajo actual (no push obligatorio, pero sí commit local para proteger las ~1500 líneas nuevas).

---

## 12. CONFIRMACIÓN

- Ningún archivo fue modificado durante esta auditoría.
- Ningún archivo fue eliminado.
- Ningún commit fue realizado.
- El documento se guardó en `00_CONTEXTO_IA/` como referencia.
- La arquitectura propuesta es backward-compatible: electricista funciona exactamente igual sin ningún cambio.
- Las verticales futuras (Luz360, Pintor360, Administrador360) se conectarán implementando `VerticalConfig` + `CatalogProvider` + (opcional) `KnowledgeProvider`.
