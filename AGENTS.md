# Reglas para agentes de desarrollo — Autonomo360

## Regla de actualización del asistente

Toda PR que añada, modifique o elimine una pantalla, ruta, flujo, función o estado (REAL/DEMO/PARCIAL/NO_DISPONIBLE) debe actualizar obligatoriamente:

1. `src/lib/assistant/app-knowledge.ts` — módulo afectado con su nuevo estado y descripción.
2. `src/lib/assistant/knowledge-version.ts` — incrementar la versión (formato: YYYY-MM-DD-vN).
3. `docs/assistant/MODULES.md` — tabla de módulos actualizada.
4. `docs/assistant/CHANGELOG.md` — línea con fecha, PR y cambio realizado.

**Una PR no está completa si el asistente queda desactualizado.**

## Reglas de seguridad

- NO enviar AI_SECRET ni ningún secreto al navegador (ni vía NEXT_PUBLIC_, ni localStorage, ni cookies JS, ni HTML).
- NO incluir instrucciones para trabajar con tensión en respuestas del asistente.
- NO presentar información fiscal como asesoramiento definitivo.
- NO asumir que TicketBAI es obligatorio en toda España.

## Reglas de no interferencia

- NO tocar TicketBAI salvo tarea específica.
- NO tocar middleware/auth salvo tarea específica.
- NO tocar facturación fiscal salvo tarea específica.
- NO añadir dependencias sin justificación explícita.
- NO usar reset, rebase ni force push sin autorización.
