# Chats Barymont — Fase 1

La gestión de conversaciones persiste en SQLite. El único transporte es DEMO: ningún estado representa entrega a un proveedor real. Producción NO VERIFICADA.

## Arranque local seguro

Usar una **base nueva**, dedicada y con nombre barymont-chats-demo.db, en una carpeta temporal o de pruebas. No reutilizar una base de negocio ni importar datos reales.

- APP_VERTICAL=barymont
- CHAT_DEMO_MODE=true
- TURSO_DATABASE_URL=file:RUTA_ABSOLUTA/barymont-chats-demo.db (la variable existente admite SQLite local; no se conecta Turso)
- DEMO_MODE desactivado: su protección global de solo lectura se conserva.
- Configurar las credenciales locales APP_BASIC_AUTH_USER y APP_BASIC_AUTH_PASSWORD; no reutilizar secretos de producción.
- Abrir localhost. Hosts externos, bases remotas y orígenes cruzados quedan bloqueados en la API.

Crear un contacto ficticio mediante Clientes en esa misma base. No se crea otro sistema de contactos. Para vincular un lead, usar una oportunidad CRM que relacione ambos: cuando solo hay un lead asociado se recupera automáticamente. La API acepta leadId explícito únicamente si el CRM ya acredita esa relación. Si hay varios, no se adivina uno.

## Flujo

Chats permite recibir un evento simulado, guardarlo, incrementar no leídos y registrar actividad CRM. Abrir el hilo marca sus mensajes como leídos. Estados: abierto, pendiente, resuelto, archivado; una nueva entrada reabre el hilo. Responsable de seguimiento como texto (no equivale a un permiso de acceso), etiquetas, notas privadas y auditoría. Las respuestas se registran como sent_demo o failed; hasta tres intentos totales. Desmarcar Simular error permite que el reintento termine. Notas: estado internal y cero intentos; no se pueden reintentar.

La clave externa del evento es obligatoria. Repetir la clave con el mismo contenido no duplica mensajes, actividades ni contadores; reutilizarla con otro contenido devuelve conflicto. Se combina una transacción de escritura con índices únicos. Los mensajes se ordenan por fecha y rowid como desempate.

Se reutilizan chat_conversations, chat_messages y chat_audit_logs del trabajo pendiente en db.ts. La migración adicional solo agrega attempts e índices únicos parciales para DEMO. Falla de forma explícita ante datos incompatibles, sin borrar duplicados. La base local electricista.db fue inspeccionada solo mediante metadatos: estas tablas no estaban desplegadas allí. No se aplicaron migraciones a esa base.

## Seguridad y límites

Basic Auth y middleware intactos. Las comprobaciones de vertical, modo, archivo local y origen se realizan antes de obtener la conexión. No hay roles de equipo añadidos; la asignación no concede ni revoca acceso. Reutilización del estilo y navegación existentes. La pantalla previa /comunicaciones no se modifica. Mensajes sistema e IA se distinguen visualmente, pero esta fase no genera mensajes mediante IA externa.

No se ha validado el catálogo comercial heredado de Barymont: se conserva sin cambiar sus productos, precios o descripciones. No son datos comerciales certificados. Las pruebas utilizan contactos de example.invalid.
