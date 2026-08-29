# Changelog del Asistente

## 2026-08-29-v20 — Capa Anti-Spam Nativa y Rate Limiting
- Implementación de `src/lib/security/` con Rate Limiting en memoria (`rate-limiter.ts`), validación de Honeypot y control temporal de envíos (`honeypot.ts`), y extractor de IP (`client-ip.ts`).
- Integración de Rate Limiting y Honeypot en `/api/prospector` para prevenir flooding y ataques automatizados sin dependencias externas.
- Suite de pruebas unitarias en `src/lib/security/__tests__/security.test.ts`.

## 2026-08-28-v15 — Endpoint Seguro de API para Prospector B2B

- Creación de `src/app/api/prospector/route.ts` que expone la lógica verificada de prospección B2B.
- Autenticación inline mediante Basic Auth o Bearer token (`PROSPECTOR_API_KEY`), sin modificar `middleware.ts`.
- Validación estricta de parámetros (`sector`, `location`, `limit`) y control de errores sin exponer stack traces.
- Cumplimiento de privacidad: aviso de consentimiento explícito y no almacenamiento de PII sin autorización.
- Actualización de `src/lib/assistant/app-knowledge.ts`, `knowledge-version.ts` y `docs/assistant/MODULES.md`.

- Sanitización total de datos hardcodeados en el código base (IBANs, NIFs, teléfonos, nombres personales).
- Creación de `src/config/app-config.ts` y `.env.example` con soporte para variables de entorno de marca e identidad (`NEXT_PUBLIC_*`).
- Nuevo panel de ajustes en `/configuracion` con formulario para datos de empresa, NIF, dirección, contacto, IBAN bancario y series de facturación.
- Persistencia en base de datos mediante tabla `company_settings` e integración en el Sidebar de navegación.
- Asset de marca genérico `public/logo-generic.svg` y actualización de `public/manifest.json`.
- Guías de usuario y comercial `README-CLIENTE.md` y `docs/GUIA-CONFIGURACION.md`.

## 2026-08-27-v13 — Sistema de Diseño, UX, Ilustraciones y PWA

- Creación de `src/lib/design-system.ts` con paleta cromática, gradientes, sombras y radios estándar.
- Nuevos componentes UI atómicos: `Card`, `Badge`, `Button`, `Skeleton`, `EmptyState` y `OnboardingBanner`.
- Rediseño visual del Dashboard con KPI cards translúcidas, gráfico mensual mejorado, onboarding inicial y alertas estilizadas.
- Assets vectoriales SVG en `public/images/` (`logo.svg`, `hero-bg.svg`, `empty-state.svg`, `success.svg`, `error.svg`).
- PWA completa con `manifest.json` y `sw.js` (Service Worker) para soporte de app instalable y caché offline.

## 2026-08-27-v12 — Validación de presupuestos con Zod (Sprint 7)

- Implementación de `src/lib/validations/budget-schema.ts` para validación estricta de presupuestos.
- Validación de `client_id`, conceptos (mínimo 1, descripción >= 2 caracteres, cantidad > 0, precio >= 0) y tipo impositivo en `POST /api/budgets`.
- Retorno HTTP 400 descriptivo en caso de payloads inválidos.

## 2026-08-27-v11 — Validación estricta con Zod (Sprint 6)

- Implementación de validación de esquemas con Zod en `src/lib/validations/client-schema.ts`.
- Validación de NIF/CIF español (DNI, NIE, CIF), emails y nombres en el endpoint `POST /api/clients`.
- Respuesta descriptiva con código HTTP 400 en caso de datos inválidos.

## 2026-08-27-v10 — Optimización de impresión y PDF (Sprint 4)

- Implementación de clases Tailwind `print:` en las vistas de detalle de Facturas y Partes de trabajo.
- Aplicado `print:break-inside-avoid` en filas de tablas, bloques de totales, observaciones y firmas para evitar cortes entre páginas.
- Ocultación garantizada de botones de acción y cabeceras de navegación en impresión (`print:hidden`).
- Bordes visibles reforzados para impresión en tablas y bloques (`print:border-slate-300`).

## 2026-08-27-v9 — Robustez offline y control de errores en conversiones

- Detección de conectividad (`navigator.onLine`) antes de iniciar conversiones en Presupuestos y Partes de trabajo.
- Control de feedback inmediato y reseteo de estados de carga para evitar bloqueos de interfaz si no hay conexión.
- Mejora en la gestión de errores de red (distinción de `TypeError` vs respuestas controladas del servidor).

## 2026-08-27-v8 — UX flujo Presupuesto→Parte→Factura

- Añadido botón "Crear parte de trabajo" en el listado de presupuestos.
- Añadido botón "Generar factura" en el listado de partes de trabajo.
- Consolidación del flujo Presupuesto → Parte de Trabajo → Factura.

## 2026-07-31-v7 — CRM comercial y WhatsApp seguro

- Nuevo CRM en `/crm` con ocho etapas, oportunidades, valor estimado y próxima acción.
- Conversión de lead a cliente y oportunidad en una operación atómica.
- Tareas, recordatorios e historial CRM integrados en la ficha de cliente.
- Plantillas genéricas sin identidad ni datos bancarios hardcodeados.
- Validación telefónica internacional y enlaces `wa.me` sin afirmar envío, entrega o lectura.
- Comunicaciones registradas como preparadas, no enviadas.
- DEMO_MODE aislado en almacenamiento temporal, bloqueado para escritura y marcado “DEMO / SIN VALIDEZ FISCAL”.
- No se modificaron numeración, IVA, TicketBAI ni lógica fiscal.

## 2026-07-18-v6 — Colores en descripciones de trabajos (PR #51)

- Cada línea de trabajo en partes puede tener un color de texto: normal, rojo, naranja, azul, verde o morado.
- Selector controlado en el formulario (desktop y móvil), sin input HEX libre.
- El color se muestra en el formulario, en el detalle del parte y en la impresión.
- Columna `color` añadida a `parte_trabajo_lineas` vía `ensureColumns` (sin migración manual).
- Partes antiguos sin color siguen funcionando (se tratan como "default").
- No se tocaron facturas, presupuestos, TicketBAI, auth ni base de datos existente.

## 2026-07-18-v5 — Modo demostración comercial integrado

- Documentado modo demo (DEMO_MODE=true) en Dashboard, Facturas y Agenda.
- Dashboard: limitación y advertencia sobre datos ficticios en modo demo.
- Facturas y Agenda: las listas demo solo se devuelven con context=dashboard-demo, no en acceso directo a /facturas o /agenda.
- Variable DEMO_MODE es solo de servidor, no expuesta al navegador.
- Los enlaces demo conducen a páginas generales, nunca a IDs inexistentes.
- Las páginas /facturas y /agenda muestran datos reales incluso con DEMO_MODE=true.

## 2026-07-16-v4 — Marca S&H Eléctricas y limpieza de facturas demo

- Marca visible en Sidebar y MobileNav cambiada a S&H Eléctricas (desde company-profile.ts).
- Las facturas de ejemplo han sido eliminadas. La instalación comienza sin facturas demo.
- El usuario puede crear su primera factura real desde /facturas/nueva.
- Script de limpieza disponible en scripts/cleanup-invoices.mjs para uso excepcional.
- La carpeta backups/ está en .gitignore (no se sube a GitHub).

## 2026-07-16-v4 — Borrado seguro de facturas por estado

- Solo se pueden eliminar facturas en estado Borrador sin registro TicketBAI.
- Facturas pendientes de Batuz, enviadas, cobradas y vencidas muestran icono de candado con tooltip explicativo.
- Backend protegido: devuelve 403 si la factura no es borrador eliminable o tiene TicketBAI.
- Filtro "Pte. Batuz" añadido a la lista de facturas.
- Confirmación mejorada: indica el número de factura y que la acción es definitiva.

## 2026-07-16-v3 — Plantilla imprimible de partes de trabajo

- Nueva ruta /partes-trabajo/plantilla con plantilla en blanco profesional de S&H Eléctricas.
- Botón "Plantilla en blanco" añadido en /partes-trabajo.
- Datos de empresa centralizados en src/lib/company-profile.ts.
- La plantilla incluye cabecera, tablas, firmas y texto legal en una sola hoja A4.
- Puede reimprimirse tantas veces como sea necesario desde el diálogo de impresión del navegador.

## 2026-07-15-v1 — Versión inicial

- Refactorización completa del asistente como guía integral de S&H Eléctricas.
- Mapa de 12 módulos con estado REAL/DEMO/PARCIAL documentado.
- Prompt territorial neutro (toda España, TicketBAI solo si aplica).
- Reglas de seguridad eléctrica obligatorias.
- Protección contra prompt injection.
- Eliminación de ALTER TABLE durante consultas.
- Versionado del conocimiento (knowledgeVersion en respuesta).
- Fallback offline mejorado con conocimiento de la app.
- Detección de consultas peligrosas con respuesta de seguridad.
- Protección delegada a Basic Auth global (eliminado checkAiSecret redundante).
