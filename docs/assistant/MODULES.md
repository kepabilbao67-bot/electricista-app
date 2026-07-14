# Módulos de Autonomo360

| Módulo | Ruta | Estado | Descripción |
|--------|------|--------|-------------|
| Dashboard | / | REAL | KPIs, gráfico mensual, alertas, acciones rápidas |
| Clientes | /clientes | REAL | CRUD, WhatsApp directo, tipos particular/empresa |
| Leads | /leads | REAL | Pipeline de captación, estados nuevo→convertido |
| Presupuestos | /presupuestos | REAL | Generador por zonas, conversión a factura |
| Facturas | /facturas | REAL | Creación, TicketBAI (solo Euskadi), descuentos, estados |
| Partes de trabajo | /partes-trabajo | DEMO | Formulario y vista imprimible, sin persistencia |
| Gastos | /gastos | REAL | Categorías de electricista, descuentos, NIF proveedor |
| Agenda | /agenda | REAL | Vista semanal, estados, Google Maps |
| Catálogo | /catalogo | REAL | Materiales coste/venta, calculadora de márgenes |
| Comunicaciones | /comunicaciones | PARCIAL | Plantillas WhatsApp/email, no envía directamente |
| Asistente/Normativa | /normativa | REAL | Chat IA + fallback offline, REBT, negocio |
| Exportar | /exportar | REAL | CSV + JSON backup |

## Estados

- **REAL**: Funciona completamente y persiste datos en base de datos.
- **DEMO**: Muestra la interfaz pero los datos no se guardan permanentemente.
- **PARCIAL**: Funciona con limitaciones documentadas.
- **NO_DISPONIBLE**: Planificado pero no implementado.

## Limitaciones conocidas

- **Partes de trabajo**: Los datos se pierden al recargar. Solo los partes demo precargados son persistentes visualmente.
- **Comunicaciones**: WhatsApp abre la app externa. Email y SMS solo generan texto para copiar.
- **Facturas — TicketBAI**: Solo aplica en Euskadi. No es obligatorio en el resto de España.
