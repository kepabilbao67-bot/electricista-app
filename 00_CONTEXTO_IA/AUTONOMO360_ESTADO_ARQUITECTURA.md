# AUTÓNOMO360 — Estado y Arquitectura (Agosto 2026)

Documento de recontextualización rápida para sesiones de desarrollo.
Generado: 2026-08-07 | HEAD: 20980cb | Rama: feat/crm-whatsapp-sprint

---

## RESUMEN EJECUTIVO

Autónomo360 es una aplicación de gestión integral para autónomos de servicios, desplegada en Vercel. El primer cliente es S&H Eléctricas (Bizkaia). La app cubre: dashboard, clientes, CRM, leads, presupuestos, facturas (con TicketBAI), partes de trabajo, gastos, agenda, catálogo, comunicaciones WhatsApp, normativa con IA y exportación.

El código contiene tanto el **núcleo reutilizable** (apto para cualquier autónomo) como **personalizaciones sectoriales** (electricidad). Se está preparando la evolución hacia SaaS multi-profesión bajo la marca Autónomo360 / Kepa360.

**Estado actual:** 14 rutas de página funcionales, 21 grupos de API, 142 tests PASS, seguridad Basic Auth fail-closed, modo DEMO implementado, PWA declarativa parcial (sin service worker).

---

## STACK TECNOLÓGICO

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript strict |
| UI | React 19 + Tailwind CSS 4 |
| DB | libSQL / Turso (SQLite compatible) |
| Deploy | Vercel |
| Auth | Basic Auth middleware (fail-closed) |
| Fiscalidad | TicketBAI (Bizkaia) con xml-crypto |
| Iconos | lucide-react |
| IDs | uuid v4 |
| Tests | node:test + tsx |
| ORM | Ninguno (SQL directo con @libsql/client) |

---

## ARQUITECTURA ACTUAL

```
electricista-app/
├── middleware.ts              → Basic Auth global (fail-closed + DEMO write-block)
├── next.config.ts             → Cabeceras seguridad (nosniff, DENY, strict-referrer)
├── src/
│   ├── app/                   → App Router
│   │   ├── layout.tsx         → Shell: Sidebar + MobileNav + Toast
│   │   ├── page.tsx           → Dashboard con KPIs
│   │   ├── asistente/         → Asistente 360 (NUEVO, sin commit)
│   │   ├── clientes/          → CRUD clientes + importación + detalle
│   │   ├── crm/               → Pipeline CRM (en progreso)
│   │   ├── leads/             → Captación → conversión
│   │   ├── facturas/          → CRUD + TicketBAI + nueva + detalle
│   │   ├── presupuestos/      → CRUD + generador zonas + edición
│   │   ├── partes-trabajo/    → CRUD + plantilla + impresión A4
│   │   ├── gastos/            → CRUD con proveedores
│   │   ├── agenda/            → Vista semanal + Google Maps
│   │   ├── catalogo/          → Materiales + calculadora márgenes
│   │   ├── comunicaciones/    → Plantillas + WhatsApp
│   │   ├── normativa/         → Chat IA (REBT + app knowledge)
│   │   ├── exportar/          → CSV + JSON backup
│   │   └── api/               → 21 grupos de endpoints REST
│   ├── components/            → 10 componentes compartidos
│   ├── hooks/                 → useAutocorrect
│   └── lib/
│       ├── db.ts              → Init DB, migraciones, generadores de número
│       ├── company-profile.ts → Datos empresa (hardcoded S&H)
│       ├── crm.ts             → Stages CRM
│       ├── templates.ts       → Plantillas mensajes (WhatsApp/email/SMS)
│       ├── ai-engine.ts       → Motor IA (OpenAI + fallback offline)
│       ├── ai-guard.ts        → Protección de secretos IA
│       ├── ai-knowledge.ts    → Conocimiento sectorial eléctrico
│       ├── ticketbai/         → Firma XML TicketBAI (Bizkaia)
│       ├── assistant/         → App knowledge + system prompt
│       ├── autonomo360/       → FUNDACIONES NUEVAS (sin commit)
│       │   ├── intent-schema.ts
│       │   ├── intent-parser.ts
│       │   ├── budget-draft.ts
│       │   ├── measurements.ts
│       │   ├── email-service.ts
│       │   └── signature-service.ts
│       └── __tests__/         → 8 archivos test (142 tests total)
├── public/                    → logo + manifest.json
├── docs/                      → Producto base, módulos, sales, assistant guides
├── sales/                     → Material comercial (demo checklist, oferta, LinkedIn)
├── scripts/                   → Migraciones y debug
└── worktree: electricista-app-kepa360/ → feat/kepa360-foundation (vertical.ts, vertical-config.ts, catalogo-servicios-tech.ts)
```

---

## INVENTARIO DE MÓDULOS

### Funcionales (REAL)

| Módulo | Ruta | Features principales |
|--------|------|---------------------|
| Dashboard | / | 8 KPIs, gráfico mensual, alertas, comparativa mensual, top clientes, acciones rápidas |
| Clientes | /clientes | CRUD, tipos particular/empresa, importación, WhatsApp directo, detalle con historial |
| CRM | /crm | Pipeline Kanban, oportunidades, stages (8), tareas, actividades, valor estimado |
| Leads | /leads | Captación, conversión atómica lead→cliente+oportunidad |
| Presupuestos | /presupuestos | CRUD, generador por zonas REBT, conversión a factura, edición, impresión |
| Facturas | /facturas | CRUD, TicketBAI Bizkaia, descuentos por línea, estados, impresión |
| Partes de trabajo | /partes-trabajo | CRUD, líneas mano obra + materiales, colores, impresión A4, plantilla blanco |
| Gastos | /gastos | CRUD, proveedores auto, categorías, descuentos |
| Agenda | /agenda | Vista semanal, vista lista, Google Maps, estados visita |
| Catálogo | /catalogo | Materiales coste/venta, calculadora márgenes |
| Normativa | /normativa | Chat IA REBT + app knowledge + fallback offline |
| Exportar | /exportar | CSV + JSON de todas las tablas |

### Parciales

| Módulo | Estado | Limitación |
|--------|--------|-----------|
| Comunicaciones | PARCIAL | Solo prepara mensajes; WhatsApp via wa.me, sin envío real email/SMS |
| Asistente 360 | NUEVO (sin commit) | Flujo texto→presupuesto borrador funcional; sin voz real, sin otros intents |

### No implementados (planificados)

- Configuración de empresa (panel)
- Multi-usuario / roles
- Email real (SMTP/proveedor)
- Firma digital con trazabilidad (modelo listo, sin UI)
- Mediciones profesionales (cálculos listos, sin UI ni persistencia)
- Finanzas avanzadas (conciliación, cuentas)
- PWA completa (service worker, offline)
- Login con pantalla (actualmente Basic Auth popup)

---

## ESQUEMA DE BASE DE DATOS

Tablas principales (SQLite/Turso):

| Tabla | Campos clave | FK |
|-------|-------------|-----|
| clients | id, name, nif, email, phone, address, client_type | — |
| invoices | id, number, client_id, date, status, total, ticketbai_* | clients |
| invoice_items | id, invoice_id, description, quantity, unit_price, discount | invoices |
| budgets | id, number, client_id, date, status, total | clients |
| budget_items | id, budget_id, description, quantity, unit_price | budgets |
| partes_trabajo | id, numero, fecha, cliente, client_id, estado, iva_rate | clients, budgets, visits |
| parte_trabajo_lineas | id, parte_id, descripcion, cantidad, precio_unitario | partes_trabajo |
| parte_materiales | id, parte_id, descripcion, cantidad, precio_coste | partes_trabajo |
| expenses | id, supplier_id, date, status, total | suppliers |
| expense_items | id, expense_id, description, quantity, unit_price | expenses |
| suppliers | id, name, nif | — |
| communications | id, client_id, type, subject, message, status | clients |
| calls | id, client_id, client_name, phone, direction | clients |
| visits | id, client_id, title, date, time, status, address | clients |
| catalog_items | id, name, unit_price, cost_price, category | — |
| leads | id, name, email, phone, source, status | — |
| opportunities | id, client_id, lead_id, title, stage, estimated_value | clients, leads |
| crm_activities | id, client_id, opportunity_id, type, title | clients, opportunities |
| crm_tasks | id, client_id, opportunity_id, title, due_at, priority, status | clients, opportunities |

---

## SEGURIDAD

| Capa | Implementación |
|------|---------------|
| Auth global | Basic Auth middleware (fail-closed sin env vars → 503) |
| DEMO write-block | Middleware bloquea POST/PUT/PATCH/DELETE en DEMO_MODE |
| Cabeceras | X-Frame-Options: DENY, X-Content-Type-Options: nosniff |
| Secrets endpoints | HEALTH_CHECK_SECRET, EXPORT_SECRET, AI_SECRET (por cabecera) |
| IA guard | ai-guard.ts bloquea datos protegidos antes de enviar a OpenAI |
| Sensitive filter | sensitive-text-filter.ts redacta datos sensibles |
| HTTPS | Forzado por Vercel |
| TicketBAI | Firma XML con certificado (xml-crypto) |

---

## TRABAJO EN PROGRESO (sin commit)

### En rama feat/crm-whatsapp-sprint (working tree principal):

| Archivo | Estado |
|---------|--------|
| src/app/crm/page.tsx | Modified (CRM WhatsApp integration) |
| src/components/Sidebar.tsx | Modified (+ruta /asistente) |
| src/components/MobileNav.tsx | Modified (+ruta /asistente) |
| src/lib/autonomo360/* | 6 módulos de fundación (intent, budget-draft, measurements, email, signature) |
| src/app/asistente/page.tsx | UI Asistente 360 |
| src/app/api/asistente/* | 2 API routes (analyze + confirm-budget) |
| src/lib/__tests__/* | 5 archivos test nuevos |
| docs/domain/ | Documentación de dominio v2 |

### En worktree feat/kepa360-foundation:

| Archivo | Estado |
|---------|--------|
| src/lib/vertical.ts | Tipo Vertical + getVertical() |
| src/lib/vertical-config.ts | Marca por vertical (sin datos personales) |
| src/lib/catalogo-servicios-tech.ts | 8 servicios tecnológicos |
| Tests asociados | 19/19 PASS |

---

## PROBLEMAS PRIORIZADOS

### Críticos (bloquean ventas)

1. **Datos empresa hardcoded** — company-profile.ts tiene NIF, nombre, dirección fijos. Imposible vender a otro cliente sin fork.
2. **Sin pantalla de login** — Basic Auth popup del navegador da impresión amateur.
3. **PWA incompleta** — Sin service worker ni iconos reales. No se puede "instalar" en móvil correctamente.

### Altos (limitan escalabilidad)

4. **Sin sistema de configuración** — No hay panel admin para cambiar marca, datos empresa, módulos activos.
5. **Email/SMS no funcional** — Solo prepara texto. No envía realmente.
6. **Sin multi-usuario** — Una sola credencial Basic Auth compartida.
7. **Acoplamiento sectorial** — Catálogos, normativa REBT, terminología eléctrica en código compartido.

### Medios (deuda técnica)

8. **Line endings mixtos** — Algunos archivos mezclan LF y CRLF.
9. **Sin service worker** — PWA declarativa pero sin offline real.
10. **Tests de integración ausentes** — Solo unit tests, no e2e.
11. **Migraciones acopladas** — ensureColumns en cada arranque; sin sistema formal de migraciones.

### Bajos (mejoras)

12. **Logo no usado en sidebar** — Existe pero no se muestra.
13. **IA requiere OPENAI_API_KEY** — Sin ella, fallback offline limitado.
14. **Export solo CSV/JSON** — Sin PDF individual desde exportar.

---

## HOJA DE RUTA POR FASES

### MVP Actual (completado ~90%)

- Dashboard completo
- Clientes CRUD
- CRM pipeline
- Leads + conversión
- Presupuestos + generador zonas
- Facturas + TicketBAI
- Partes de trabajo
- Gastos
- Agenda
- Catálogo
- Comunicaciones (WhatsApp)
- Normativa IA
- Exportar
- Basic Auth
- Modo DEMO

**Pendiente MVP:** integrar CRM WhatsApp (en progreso), commitear trabajo actual.

### V1 — Producto vendible

1. Panel de configuración de empresa (nombre, NIF, logo, teléfono, email)
2. Pantalla de login real (sustituir Basic Auth popup)
3. Integrar Asistente 360 (texto → presupuesto borrador)
4. Service worker + iconos PWA reales
5. Vertical configurable (electricista/tecnología) via APP_VERTICAL
6. Email básico (envío de presupuestos/facturas como adjunto o link)

### V2 — SaaS multi-profesión

7. Multi-tenant: cada cliente tiene su instancia/DB
8. Onboarding guiado (configurar empresa en primer acceso)
9. Módulos activables/desactivables por plan
10. Firma digital con trazabilidad (ya tiene modelo)
11. Mediciones profesionales (ya tiene cálculos)
12. Parser IA avanzado (OpenAI/Anthropic para lenguaje natural)
13. Voz real (Web Speech API + transcripción)
14. Recordatorios automáticos de cobro

### Escalado

15. Multi-usuario con roles (admin, técnico, comercial)
16. API pública para integraciones
17. Marketplace de catálogos sectoriales
18. Finanzas avanzadas (conciliación, PSD2)
19. App nativa (PWA → capacitor/expo si necesario)
20. Analytics y reporting avanzado

---

## PROPUESTA DE MEJORAS (respetando arquitectura existente)

| Mejora | Impacto | Esfuerzo | Archivos afectados |
|--------|---------|----------|-------------------|
| company-profile.ts configurable | Alto | Bajo | company-profile.ts, layout.tsx, Sidebar, MobileNav |
| Integrar vertical.ts del worktree | Alto | Bajo | Merge worktree + adaptar layout/Sidebar |
| Login screen (sobre Basic Auth) | Alto | Medio | Nueva ruta /login, middleware ajuste |
| SW mínimo + iconos PWA | Medio | Bajo | public/sw.js, public/icon-*.png, manifest.json |
| Commitear Asistente 360 | Alto | Nulo | Solo git add + commit |
| Email service con communications | Medio | Medio | email-service.ts + nueva API + UI comunicaciones |
| Panel config empresa | Alto | Medio | Nueva ruta /configuracion, API, company-profile refactor |

---

## ARCHIVOS QUE SE MODIFICARÍAN EN FUTURAS IMPLEMENTACIONES

### Para V1 (no tocar todavía):

| Archivo | Cambio previsto |
|---------|----------------|
| src/lib/company-profile.ts | Leer de DB/env en vez de hardcoded |
| src/app/layout.tsx | Metadata dinámica por empresa |
| src/components/Sidebar.tsx | Logo + marca configurable |
| src/components/MobileNav.tsx | Idem |
| middleware.ts | Realm dinámico, posible session auth |
| public/manifest.json → src/app/manifest.ts | Dinámico por vertical |
| package.json | (si se necesita bcrypt o session lib) |
| Nuevos: src/app/configuracion/, src/app/login/, public/sw.js |

### Para Asistente 360 (ya implementado, solo falta commit):

| Archivo | Estado |
|---------|--------|
| src/app/asistente/page.tsx | Listo |
| src/app/api/asistente/analyze/route.ts | Listo |
| src/app/api/asistente/confirm-budget/route.ts | Listo |
| src/lib/autonomo360/*.ts | Listo (6 módulos) |

---

## TESTS

```
Total: 142 tests / 29 suites
PASS: 142
FAIL: 0
Framework: node:test + tsx
Duración: ~437ms
```

Cobertura por área:
- CRM/WhatsApp: validaciones seguras
- Normalización precios: edge cases
- Partes trabajo: validación payload
- Intent schema: security levels, parsing
- Budget draft: cálculos, validaciones
- Measurements: geometría, conversiones, pendientes
- Email/Signature: validación, sanitización, hash

---

## CÓMO RETOMAR

1. `cd C:\Users\foca-\OneDrive\Escritorio\01_PROYECTOS_ACTIVOS\Autonomo360\electricista-app`
2. Branch actual: `feat/crm-whatsapp-sprint` @ `20980cb`
3. Trabajo sin commit: CRM WhatsApp + Asistente 360 + fundaciones autonomo360/
4. Worktree Kepa360: `electricista-app-kepa360` (rama feat/kepa360-foundation)
5. Tests: `npx tsx --test src/lib/__tests__/*.test.ts` → 142 PASS
6. No hay secretos expuestos ni datos reales en código nuevo
7. Protegidos (NO TOCAR sin contexto): `src/app/crm/page.tsx`, `docs/domain/`

---

## DECISIONES ARQUITECTÓNICAS VIGENTES

1. **Un solo repo** con configuración por vertical (no monorepo, no fork).
2. **APP_VERTICAL** en servidor, propagada via Server Components (no NEXT_PUBLIC).
3. **Asistente 360** con parser determinista local + adaptador IA futuro.
4. **CONFIRM_REQUIRED** obligatorio para toda operación económica del asistente.
5. **Fundaciones puras** (measurements, email, signature) sin dependencias externas.
6. **Status "draft" siempre** hasta confirmación humana explícita.
7. **TicketBAI solo Bizkaia** — no generalizar sin asesor fiscal.
8. **DEMO_MODE** usa DB temporal aislada y bloquea escrituras.
