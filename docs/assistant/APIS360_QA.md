# Electricista 360 × APIs360 (solo QA)

Integración de consulta informativa local y opcional en `/normativa`.
Sin cambios en presupuestos, facturación, TicketBAI o confirmaciones de acciones.

## Funcionamiento
- `GET /api/assistant` devuelve disponibilidad tras autenticación global.
- `POST /api/assistant` con `mode=apis360-local` es informativo y
  no usa historial, catálogo, CRM ni herramientas.
- Solo en desarrollo local con `ELECTRICISTA360_ENABLE_LOCAL_AI=1`.
  **En `NODE_ENV=production` siempre desactivado.**
- Validación del origen, host, limitación a 1200 caracteres y rechazo
  de datos sensibles mediante filtro existente.
- Gateway fijado a `127.0.0.1:3737/v1`; proyecto `electricista360`;
  modelo exclusivamente local y coste API externo comprobado en 0 USD.
- Si está desconectado, la interfaz indica que no se generó una
  respuesta IA y no pasa automáticamente a un modelo cloud.
- El contenido de REBT requiere revisión y cumplimiento normativo,
  y las consultas peligrosas siguen bloqueadas por el motor de seguridad.

## Bloqueos antes de fusionar
- El PC con gateway APIs360 está desconectado; no se ha certificado
  generación real en Electricista desde el portátil.
- No conectar móvil o Vercel al loopback sin backend seguro y autenticado.
- Revisar el trabajo local del PC y los permisos por cliente/tenant.
- No fusionar esta PR ni desplegar en producción hasta esa verificación.

## Pruebas
`node --experimental-strip-types --test tests/apis360-local.test.mjs`
`npm run lint`
`npm run build`
`git diff --check`
