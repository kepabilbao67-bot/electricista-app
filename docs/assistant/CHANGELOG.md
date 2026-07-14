# Changelog del Asistente Autonomo360

## 2026-07-15-v2 — Modo demostración comercial

- Documentado modo demo (DEMO_MODE=true) en Dashboard, Facturas y Agenda.
- Dashboard: limitación y advertencia sobre datos ficticios en modo demo.
- Facturas y Agenda: indicación de que las listas demo no son registros persistidos.
- Variable DEMO_MODE es solo de servidor, no expuesta al navegador.
- Los enlaces demo conducen a páginas generales, nunca a IDs inexistentes.

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
