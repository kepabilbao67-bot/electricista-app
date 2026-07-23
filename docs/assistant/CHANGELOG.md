# Changelog del Asistente S&H Eléctricas

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
