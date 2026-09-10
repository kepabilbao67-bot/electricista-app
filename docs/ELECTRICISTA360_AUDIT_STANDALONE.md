# Electricista360 — Auditoría de separación y endurecimiento

Fecha: 2026-09-10
Rama de trabajo: `refactor/electricista360-standalone`
Base funcional: `7242a80`

## Veredicto

Electricista360 funciona como aplicación sectorial, pero el repositorio sigue mezclando responsabilidades de Autónomo360, Barymont, Tecnología y hasta un módulo de LinguaFox. La separación actual es lógica por configuración, no física ni conceptual. Esto aumenta el riesgo de regresiones, confusión operativa y despliegues equivocados.

## Hallazgos críticos

### A1 — Mezcla de verticales dentro del repositorio — ALTO

`src/lib/core/vertical-loader.ts` carga `electricista`, `general`, `barymont` y una variante `tecnologia`. Para Electricista360 standalone esto es complejidad innecesaria y permite arrancar la misma aplicación con otro negocio mediante `APP_VERTICAL`.

Objetivo: Electricista360 debe tener una única identidad de producto. Los componentes comunes pueden mantenerse, pero no deben seleccionar otras verticales.

### A2 — Código Autónomo360 incrustado — ALTO

Existe `src/lib/autonomo360/` con lógica de presupuestos, email, parser de intenciones, mediciones y firma. Parte puede ser reutilizable, pero el namespace acopla Electricista360 al producto matriz.

Objetivo: clasificar cada archivo como `core` reutilizable o `electricista` sectorial y moverlo sin pérdida funcional.

### A3 — Verticales ajenas y artefactos comerciales — MEDIO/ALTO

Existen `src/lib/verticals/general`, `src/lib/verticals/barymont`, documentación, ventas y skills de Autónomo360 dentro del repositorio de Electricista360. También existe `src/lib/linguafox/spaced-repetition.ts`, claramente ajeno al producto.

Objetivo: eliminar del runtime y después del repositorio todo lo que no sea Electricista360 o infraestructura compartida estrictamente necesaria.

### A4 — Catálogo con semántica insegura de precio cero — CRÍTICO

`catalog_items.unit_price` es `REAL NOT NULL`. El catálogo sectorial contiene placeholders con `unitPrice: 0`, y distintos flujos pueden interpretar 0 € como precio comercial real.

Objetivo: representar explícitamente `precio pendiente` y bloquear cualquier persistencia comercial accidental a 0 € procedente del catálogo.

### A5 — Catálogo de proveedor insuficiente — ALTO

El schema de `catalog_items` no modela de forma nativa proveedor, referencia de proveedor, fecha de tarifa ni documento origen. La integración SOKOEL necesita esa trazabilidad.

Objetivo: diseñar una extensión compatible e idempotente para proveedor/referencia/coste/fecha/documento, evitando duplicados.

### A6 — Migraciones embebidas en `db.ts` con errores silenciados — ALTO

`ensureColumns()` captura errores de `ALTER TABLE` y también errores de inspección sin registrarlos. Esto puede dejar una base parcialmente migrada sin señal clara.

Objetivo: migraciones verificables, con versión de schema y fallo explícito en cambios críticos.

### A7 — Nombres de serie inconsistentes — MEDIO

Configuración declara prefijos `FAC-`, `PRES-` y `PT-`, pero `generateInvoiceNumber()` usa `DFB_` y `generateBudgetNumber()` usa `PRES_`. La configuración central no gobierna realmente estas funciones.

Objetivo: una sola fuente de verdad para numeración, sin cambiar numeraciones existentes de producción sin migración controlada.

### A8 — CI incompleta — ALTO

El workflow `ci.yml` ejecuta TypeScript dos veces (`tsc` directo y `npm run lint`, que también es `tsc --noEmit`). No ejecuta tests, build ni `audit:isolation`.

Objetivo: CI mínima obligatoria: typecheck, tests, build y auditoría de aislamiento.

### A9 — Auditoría de aislamiento demasiado estrecha — ALTO

`scripts/audit-isolation.cjs` solo detecta imports directos a carpetas de ciertas verticales. No detecta carpetas/artefactos ajenos como `src/lib/autonomo360`, `src/lib/linguafox`, `sales/AUTONOMO360_*` o configuración multi-vertical.

Objetivo: convertirla en una auditoría de standalone real, con allowlist/denylist explícita.

### A10 — Branding genérico/Autónomo360 residual — MEDIO

`src/config/app-config.ts`, comentarios del core y claves como `autonomo360_theme` conservan identidad de Autónomo360. No rompe funcionalidad, pero dificulta mantener Electricista360 como producto separado.

Objetivo: branding Electricista360 por defecto y compatibilidad temporal para claves antiguas.

### A11 — Auth temporal — MEDIO/ALTO

La aplicación depende de Basic Auth global. Es útil como barrera temporal, pero no sustituye autenticación de usuario/roles si Electricista360 se comercializa como SaaS o multiusuario.

Objetivo: mantener Basic Auth para despliegues privados actuales; diseñar auth real antes de venta SaaS multiusuario.

### A12 — Código/pantallas sobredimensionadas — MEDIO

Existen componentes y páginas de gran tamaño (`ParteForm`, cliente detalle, CRM, presupuestos). Esto eleva coste de mantenimiento y riesgo de regresiones.

Objetivo: refactor progresivo por dominio, sin reescritura masiva.

## Lo que sí está bien y debe conservarse

- Next.js 16 + React 19 y TypeScript.
- Base libSQL/Turso con bloqueo de fallback local en serverless cuando falta configuración.
- Tests en base aislada para no tocar producción.
- Flujo partes → factura y cobertura específica de conversión.
- TicketBAI aislado en `src/lib/ticketbai` y con tests dedicados.
- Módulos eléctricos: partes, trabajos, normativa, catálogo y asistente sectorial.
- Integración SOKOEL basada en datos de la oferta, manteniendo coste separado de venta.

## Plan de separación

### Fase E1 — Identidad standalone, sin romper runtime

1. Fijar Electricista360 como única vertical activa.
2. Eliminar selección `APP_VERTICAL` del runtime de Electricista360.
3. Mantener `core` solo como utilidades neutrales del propio producto.
4. Cambiar branding por defecto a Electricista360.
5. Reforzar auditoría de aislamiento y CI.

### Fase E2 — Limpieza de dependencias ajenas

1. Mover lógica útil de `src/lib/autonomo360` a `src/lib/core` o `src/lib/electricista`.
2. Eliminar `general`, `barymont`, `tecnologia` del repositorio standalone una vez no existan imports.
3. Retirar `LinguaFox` y activos de ventas/documentación de Autónomo360 del runtime/repositorio.

### Fase E3 — Catálogo profesional

1. Introducir estado explícito de precio pendiente.
2. Modelar proveedor, referencia, fecha de precio y documento origen.
3. Integrar SOKOEL de forma idempotente.
4. Bloquear presupuesto/factura si un artículo de catálogo no tiene precio de venta válido.

### Fase E4 — Persistencia y migraciones

1. Versionado de schema.
2. Migraciones explícitas y verificadas.
3. Backups y rollback documentados.
4. No silenciar fallos críticos de migración.

### Fase E5 — Preparación comercial

1. Auth real y roles si habrá varios usuarios.
2. Revisión TicketBAI por territorio y datos de emisor.
3. Observabilidad y health checks.
4. QA móvil/PWA y flujos completos.

## Regla de ejecución

Ninguna fase debe desplegarse a producción automáticamente. Todos los cambios se realizan en rama separada, con tests y build antes de PR. No se toca `main` sin aprobación explícita.
