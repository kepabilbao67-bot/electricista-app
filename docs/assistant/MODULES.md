# Módulos de Autonomo360

| Módulo | Ruta | Estado | Descripción |
|--------|------|--------|-------------|
| Dashboard | / | REAL | KPIs, gráfico mensual, alertas, acciones rápidas |
| Clientes | /clientes | REAL | CRUD, WhatsApp directo, tipos particular/empresa |
| Leads | /leads | PARCIAL | Pipeline de captación, estados nuevo→convertido (sin conversión automática a cliente) |
| Presupuestos | /presupuestos | REAL | Generador por zonas, conversión a factura |
| Facturas | /facturas | REAL | Creación, TicketBAI (ver nota territorial), descuentos, estados. Solo borradores sin TicketBAI se pueden eliminar. |
| Partes de trabajo | /partes-trabajo | DEMO | Formulario y vista imprimible, sin persistencia. Plantilla en blanco en /partes-trabajo/plantilla |
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

- **Leads**: Los leads se guardan y se puede cambiar su estado, pero marcar un lead como convertido no crea automáticamente un cliente.
- **Partes de trabajo**: Los datos se pierden al recargar. Solo los partes demo precargados son persistentes visualmente.
- **Comunicaciones**: WhatsApp abre la app externa. Email y SMS solo generan texto para copiar.
- **Facturas — TicketBAI**: TicketBAI es un sistema fiscal implantado en los territorios históricos de Euskadi. Su aplicación depende del territorio, actividad y situación fiscal. Batuz es la implementación de Bizkaia. Verificar con la Hacienda Foral correspondiente o con un asesor.
