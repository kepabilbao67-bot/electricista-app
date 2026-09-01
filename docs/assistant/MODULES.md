# Módulos de Autonomo360

| Módulo | Ruta | Estado | Descripción |
|--------|------|--------|-------------|
| Dashboard | / | REAL | KPIs, gráfico mensual, alertas, modo oscuro nativo, acciones rápidas |
| Clientes | /clientes | REAL | CRUD, WhatsApp directo, tipos particular/empresa |
| CRM comercial | /crm | REAL | Pipeline, oportunidades, valor estimado, próxima acción, tareas e historial |
| Leads | /leads | REAL | Captación con protección anti-spam, dictado por voz nativo y conversión atómica |
| Presupuestos | /presupuestos | REAL | Generador por zonas, crear parte de trabajo, conversión a factura, robustez offline |
| Facturas | /facturas | REAL | Creación, TicketBAI (ver nota territorial), descuentos, estados, optimización de impresión. Solo borradores sin TicketBAI se pueden eliminar. |
| Partes de trabajo | /partes-trabajo | REAL | Formulario, vista imprimible profesional optimizada (evita cortes de página), generar factura, colores por línea, persistencia, robustez offline. Plantilla /partes-trabajo/plantilla |
| Gastos | /gastos | REAL | Categorías de electricista, descuentos, NIF proveedor |
| Agenda | /agenda | REAL | Vista semanal, estados, Google Maps |
| Catálogo | /catalogo | REAL | Materiales coste/venta, calculadora de márgenes |
| Comunicaciones | /comunicaciones | PARCIAL | Plantillas seguras y wa.me; registra preparación, no confirma envío |
| Asistente/Normativa | /normativa | REAL | Chat IA + fallback offline, REBT, negocio |
| Ayuda y Sugerencias | /ayuda | REAL | FAQs interactivas, dictado por voz, reporte de bugs y buzon de sugerencias protegido con anti-spam |
| Exportar | /exportar | REAL | CSV + JSON backup |
| Configuración | /configuracion | REAL | Personalización White-Label (datos empresa, series, IVA e IBAN) |
| Prospector B2B | /api/prospector | PARCIAL | Endpoint de prospección B2B verificada con Rate Limiting y Honeypot |

## Estados

- **REAL**: Funciona completamente y persiste datos en base de datos.
- **DEMO**: Muestra la interfaz pero los datos no se guardan permanentemente.
- **PARCIAL**: Funciona con limitaciones documentadas.
- **NO_DISPONIBLE**: Planificado pero no implementado.

## Limitaciones conocidas

- **Leads**: La acción de conversión crea cliente y oportunidad; el cambio manual de estado sigue siendo solo clasificatorio.
- **Partes de trabajo**: Completamente funcional con persistencia en base de datos. Colores de texto por línea disponibles (6 opciones controladas).
- **Comunicaciones**: WhatsApp abre la app externa. Email y SMS solo generan texto para copiar.
- **Facturas — TicketBAI**: TicketBAI es un sistema fiscal implantado en los territorios históricos de Euskadi. Su aplicación depende del territorio, actividad y situación fiscal. Batuz es la implementación de Bizkaia. Verificar con la Hacienda Foral correspondiente o con un asesor.

## Modo demostración (DEMO_MODE)

Variable de servidor `DEMO_MODE=true` que activa datos ficticios para demostraciones comerciales.

**Características:**
- No escribe datos en la base de datos.
- El Dashboard muestra KPIs, alertas, facturas y visitas ficticias identificados con etiqueta "Modo demostración".
- Las facturas y visitas ficticias solo se devuelven cuando el Dashboard añade el parámetro context=dashboard-demo a las peticiones.
- Toda persistencia usa una base temporal aislada cuando DEMO_MODE=true.
- Las operaciones de escritura (POST, PUT, PATCH y DELETE) quedan bloqueadas por middleware.
- Los enlaces demo conducen a páginas generales (/facturas, /presupuestos, /agenda), no a registros inexistentes.
- `DEMO_MODE=false` o ausente conserva el comportamiento real en todos los endpoints.
- No se expone al navegador (no es NEXT_PUBLIC).
- La interfaz muestra “DEMO / SIN VALIDEZ FISCAL”.

**Módulos afectados en modo demo:**
- Dashboard: datos ficticios completos (KPIs, gráfico, alertas, top clientes).
- Facturas (solo GET con context=dashboard-demo): 5 facturas demo.
- Agenda (solo GET con context=dashboard-demo): 4 visitas demo.

Las páginas /facturas y /agenda NO muestran datos ficticios. Solo el Dashboard consume los datos demo.

## Chats Barymont — Fase 1 local

| Módulo | Ruta | Estado | Alcance |
|---|---|---|---|
| Chats Barymont | `/comunicaciones/chats` | DEMO | Persistencia SQLite real en base de pruebas; transporte simulado. Solo Barymont. |

Conversaciones, filtros, búsqueda, asignación, etiquetas, no leídos, notas internas, contacto/lead del CRM y auditoría. Tres intentos como máximo; ninguna nota interna se envía. WhatsApp, email, llamadas e IA externa no conectados. Producción NO VERIFICADA. Configuración y límites en `docs/communications/CHATS.md`.
