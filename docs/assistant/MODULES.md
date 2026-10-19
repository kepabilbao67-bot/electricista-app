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
| Catálogo | /catalogo | REAL | Materiales coste/venta, proveedor y referencia, estado de precio de venta pendiente, calculadora de márgenes |
| Pedido por voz | /pedidos-voz | REAL | Dictado móvil (puente nativo Android o Web Speech API), interpretación estructurada, revisión editable y guardado tras confirmación |
| Asistente Voz 360 | /asistente | REAL | Conversación por voz/teclado, borrador multivuelta (crear, añadir, modificar cantidad/precio, fijar IVA), catálogo y consultas reales, confirmación previa a escrituras |
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
- **Voz 360 — dictado en móvil**: El WebView de Android no expone la Web Speech API. En la APK el dictado usa el puente nativo (`window.AndroidSTT`) y el reconocedor del propio teléfono; si no hay ninguno instalado o el origen no es seguro, el botón muestra "Dictado no disponible aquí" en lugar de simular que escucha. La Web Speech API sigue usándose en escritorio.
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

## Precios decimales — 2026-10-18

Facturas, presupuestos (alta y edición), catálogo/calculadora, gastos, CRM y partes: coma o punto, hasta dos decimales; céntimos inferiores a un euro conservados. Totales calculados desde las líneas. Sin cambios impositivos ni de emisión fiscal.

## Obras en presupuestos — 2026-10-18

Nombre del trabajo y dirección de obra independientes del cliente, visibles en listado móvil/escritorio y detalle/PDF. Editables; al duplicar se conserva el cliente y se pide una nueva obra y dirección; los históricos muestran “sin indicar” hasta completarlos.

## Escritura en colores (2026-10-19)
- Presupuestos: conceptos y obra con selector propio, notas independientes; conservados en borrador, duplicado, edición y PDF.
- Facturas: conceptos y notas al crear y desde el detalle; persistencia y conversión desde presupuesto.
- Selectores existentes de clientes, catálogo, agenda, comunicaciones, leads y partes: contraste adaptado al tema y a impresión.

## Colores generales (2026-10-19)
REAL: botón Colores disponible en todos los módulos, con escritura, texto, botones, fondo, formularios y menú. Guardado compartido y vista previa; los colores propios de cada documento tienen prioridad. Catálogo, agenda y leads conservan los colores también al mostrar sus registros.

## Identidad de documentos (2026-10-19)
Logo S&H Eléctricas según referencia del usuario en presupuestos, facturas y partes, incluidos PDF y plantilla. La plantilla lee los datos guardados de empresa.
