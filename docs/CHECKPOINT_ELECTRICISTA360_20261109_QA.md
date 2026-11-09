# Electricista 360 - checkpoint QA 2026-11-09

## Alcance
Copia local en el portátil KEPA, rama feat/electricista360-apis360-local-20261106. Ningún cambio desplegado a producción ni cambios intencionados en Turso.

## Incorporado en copia QA
- Recuperado módulo original Faltantes de obra del snapshot Electricista360-ruido-obra-20261008, incluyendo pantalla, rutas API, parser, pruebas y esquema de tabla faltantes_obra.
- Integrado dictado a través del componente existente VoiceDictation y respuesta leída mediante SpeechSynthesis del navegador. **No es una integración certificada con servicio central Voz 360.**
- Menú renombrado a Materiales y servicios y añadido Faltantes de obra.
- Documentos 360 v0.6 copiado al directorio public/documentos360; ruta /documentos y enlace en navegación. El editor usa borradores locales del navegador y varias bibliotecas externas; su IA documental no está certificada aquí.
- Middleware reemplazado por src/proxy.ts (Next.js 16). Las rutas /documentos y /documentos360/index.html redirigen al acceso para visitantes sin sesión, /api/catalog devuelve 401, /acceso devuelve 200 tras regeneración de .next/dev.

## Verificaciones realizadas
- 29 pruebas de parser, API, navegación, recuperación y duración de sesión: 29 OK.
- TypeScript noEmit: exit 0.
- Web /documentos y /faltantes-obra respondieron 200 antes de activar proxy; rutas protegidas 307 sin sesión después. Una sesión firmada por la API fue verificada para 30 días en prueba unitaria.
- Compilación optimizada de producción `npm run build`: **exit 0**, generadas `/documentos`, `/faltantes-obra`, `/api/faltantes-obra` y `Proxy (Middleware)`.

## Actualización de recuperación y Documentos 360
- Añadida ruta `/restablecer` y API `/api/password-recovery`.
- Restablecimiento con token aleatorio de 256 bits, hash en BD, 15 minutos, uso único, límite de 1 solicitud por 10 minutos y contraseña nueva cifrada por hash scrypt con sal.
- El nuevo secreto de inicio de sesión se guarda en `electricista_auth_credentials` y la revisión revoca cookies anteriores. La credencial anterior de entorno sigue como respaldo únicamente antes del primer restablecimiento.
- Proveedor de correo preparado vía Resend. En producción deben existir `AUTH_RECOVERY_EMAIL` (correo del propietario autorizado), `APP_PUBLIC_URL` (URL HTTPS real), `RESEND_API_KEY` y `RESEND_FROM_EMAIL` (remitente verificado). Sin ellas se devuelve 503 y no se cambia ninguna credencial.
- Documentos 360 cambia su cabecera de DENY a SAMEORIGIN tanto en `next.config.ts` como en `vercel.json`.
- Test de recuperación extremo a extremo con fetch de correo simulado: revocación, contraseña antigua rechazada, nueva aceptada, enlace de un uso. No se han enviado correos reales.
- Pruebas específicas: 29 correctas, 0 fallos. TypeScript exit 0. Build optimizada de esta revisión: exit 0, confirmada ruta /restablecer.

## Pendientes BLOQUEANTES
- Vercel verificado 2026-11-09: `AUTH_RECOVERY_EMAIL` configurada de forma cifrada para producción y preview con kepabilbao67@gmail.com; `APP_PUBLIC_URL` configurada para producción con https://electricista-app-two.vercel.app. El correo de recuperación queda **inactivo**, ya que `RESEND_API_KEY` y `RESEND_FROM_EMAIL` no están configuradas. No se ha enviado ningún correo ni cambiado la contraseña de producción.
- No se ha probado Documentos 360 desde navegador real con carga y descarga de archivos.
- No se ha publicado ni verificado ningún despliegue de cliente y deben comprobarse las migraciones y aislamiento de datos antes de activar nuevas rutas.
- No confirmar operación de reconocimiento o síntesis de voz en dispositivos del cliente sin prueba real.

## Seguridad
No publicar cambios de QA sin verificación funcional de autenticación, base de datos y backups. No cambiar secretos ni borrar datos. Archivos electricista.db-wal y electricista.db-shm pertenecen a SQLite local y no se han incluido en Git.
