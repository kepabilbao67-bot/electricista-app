# Reglas de proyecto — Autónomo360

## Arquitectura verificada

- Framework: Next.js (App Router) con React y TypeScript
- Estilos: Tailwind CSS
- Base de datos: Turso (libSQL) — producción remota, desarrollo local con archivo SQLite
- Autenticación: Basic Auth en middleware.ts (fail-closed)
- Hosting: Vercel
- PWA: manifest.json, apple-mobile-web-app
- Estructura de código:
  - Páginas: `src/app/`
  - APIs: `src/app/api/`
  - Componentes: `src/components/`
  - Librerías: `src/lib/`
  - Steering y skills: `.kiro/`

## Convenciones del proyecto

- TypeScript estricto
- Tailwind para estilos (no CSS modules)
- Componentes con `"use client"` para interactividad
- APIs con NextRequest / NextResponse
- UUIDs v4 como claves primarias
- Fechas en formato ISO almacenadas como TEXT
- Migraciones idempotentes con `ensureColumns` (ALTER TABLE ADD COLUMN)
- No se usa ORM
- Cada route.ts llama `getDbClient()` + `initializeDatabase()`
- CREATE TABLE IF NOT EXISTS para creación idempotente de tablas
- No usar `git add .` ni `git add -A` — siempre archivos específicos

## Numeración de documentos

- Facturas: DFB_NNNN
- Presupuestos: PRES_NNNN
- Partes de trabajo: PT-YYYY-NNN

## Zonas sensibles — no modificar sin autorización

| Zona | Motivo |
|---|---|
| Facturas (IVA, totales, numeración) | Lógica fiscal |
| TicketBAI (campos de firma) | Certificación fiscal pendiente |
| middleware.ts | Auth fail-closed |
| Variables de entorno (.env.*) | Credenciales |
| Impresión A4 (globals.css + layout.tsx @media print) | Estable, validado |
| sensitive-text-filter.ts | Seguridad IA |
| Base de datos de producción | Solo lectura con autorización |

## Turso y base de datos

- Producción: URL en `TURSO_DATABASE_URL` con `TURSO_AUTH_TOKEN`
- Desarrollo: archivo local `electricista.db`
- No ejecutar INSERT/UPDATE/DELETE en producción sin:
  1. Diagnóstico previo (SELECT)
  2. Backup verificado
  3. Dry-run documentado
  4. Plan de rollback
  5. Autorización explícita

## Vercel y producción

- Deploy automático desde main
- No hacer push a main sin PR revisada
- No modificar variables de entorno desde el agente
- No acceder al dashboard de Vercel

## Autenticación

- Basic Auth con `APP_BASIC_AUTH_USER` y `APP_BASIC_AUTH_PASSWORD`
- Si las variables no existen: respuesta 503 (fail-closed)
- Protege todas las rutas excepto assets estáticos

## IA y datos sensibles

- Filtro en `sensitive-text-filter.ts`: bloquea NIF, IBAN, email, teléfono, importes, fechas, horas, URLs antes de enviar a OpenAI
- El botón "Corregir texto" se oculta si no hay API key configurada
- Errores 401/429/5xx devuelven mensajes amigables sin términos técnicos
- No loguear texto del usuario ni respuesta de IA

## Impresión A4

- @page margin 6mm
- Font 12px body, 11px tablas
- .no-print oculta botones y nav
- .print-show muestra tabs ocultas
- .print-keep-together protege firmas
- Partes normales deben caber en 1 página A4

## AGENTS.md

Si existe AGENTS.md en el repositorio, cumplir sus reglas. Actualmente exige:

1. Actualizar `src/lib/assistant/app-knowledge.ts` en cada PR que modifique funcionalidad
2. Actualizar `src/lib/assistant/knowledge-version.ts` (incrementar versión)
3. Actualizar `docs/assistant/MODULES.md`
4. Actualizar `docs/assistant/CHANGELOG.md`

## Datos personales

- No incluir nombres completos, NIF, teléfono, dirección, email ni datos de clientes reales en archivos de skill, informes públicos ni logs
- Usar referencias genéricas: "el cliente", "la empresa", "el propietario"
- Los datos del perfil de empresa (`company-profile.ts`) se consultan en código pero no se reproducen en documentación de skills

## Incidencias temporales

- No registrar incidencias temporales como reglas permanentes en este archivo
- Las incidencias se documentan en el informe del turno (template)
- Cuando una incidencia se resuelve, se elimina del informe siguiente

## Cambios ajenos

- Todo cambio existente que no pertenezca al bloque actual debe conservarse tal cual.
- No modificarlo, descartarlo, moverlo ni incorporarlo al staging o a un commit propio.
- Si afecta a un archivo necesario para el trabajo, detenerse e informar antes de continuar.
- Nunca usar reset, restore, checkout, clean u otro mecanismo para eliminarlo sin autorización expresa.

## Datos DEMO

- Modo DEMO activado con `DEMO_MODE=true` (variable de entorno)
- En modo DEMO el middleware bloquea escrituras API (POST/PUT/PATCH/DELETE)
- Los datos DEMO deben ser completamente ficticios
- Marcar siempre como "DEMO / SIN VALIDEZ FISCAL"
- No copiar datos reales de ningún cliente, captura ni proyecto externo
