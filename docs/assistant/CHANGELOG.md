# Changelog del Asistente Autonomo360

## 2026-07-16-v4 — Marca S&H Eléctricas y limpieza de facturas demo

- Marca visible en Sidebar y MobileNav cambiada a S&H Eléctricas (desde company-profile.ts).
- Las facturas de ejemplo han sido eliminadas. La instalación comienza sin facturas demo.
- El usuario puede crear su primera factura real desde /facturas/nueva.
- Script de limpieza disponible en scripts/cleanup-invoices.mjs para uso excepcional.
- La carpeta backups/ está en .gitignore (no se sube a GitHub).

## 2026-07-16-v3 — Plantilla imprimible de partes de trabajo

- Nueva ruta /partes-trabajo/plantilla con plantilla en blanco profesional de S&H Eléctricas.
- Botón "Plantilla en blanco" añadido en /partes-trabajo.
- Datos de empresa centralizados en src/lib/company-profile.ts.
- La plantilla incluye cabecera, tablas, firmas y texto legal en una sola hoja A4.
- Puede reimprimirse tantas veces como sea necesario desde el diálogo de impresión del navegador.

## 2026-07-15-v1 — Versión inicial

- Refactorización completa del asistente como guía integral de Autonomo360.
- Mapa de 12 módulos con estado REAL/DEMO/PARCIAL documentado.
- Prompt territorial neutro (toda España, TicketBAI solo si aplica).
- Reglas de seguridad eléctrica obligatorias.
- Protección contra prompt injection.
- Eliminación de ALTER TABLE durante consultas.
- Versionado del conocimiento (knowledgeVersion en respuesta).
- Fallback offline mejorado con conocimiento de la app.
- Detección de consultas peligrosas con respuesta de seguridad.
- Protección delegada a Basic Auth global (eliminado checkAiSecret redundante).
