# Módulos de Autonomo360

| Módulo | Ruta | Estado | Descripción |
|--------|------|--------|-------------|
| Dashboard | / | REAL | KPIs, gráfico mensual, alertas, acciones rápidas |
| Clientes | /clientes | REAL | CRUD, WhatsApp directo, tipos particular/empresa |
| Leads | /leads | PARCIAL | Pipeline de captación, estados nuevo→convertido (sin conversión automática a cliente) |
| Presupuestos | /presupuestos | REAL | Generador por zonas, conversión a factura |
| Facturas | /facturas | REAL | Creación, TicketBAI (ver nota territorial), descuentos, estados. Solo borradores sin TicketBAI se pueden eliminar. |
| Partes de trabajo | /partes-trabajo | REAL | Formulario, vista imprimible, colores por línea de trabajo, persistencia en DB. Plantilla en blanco en /partes-trabajo/plantilla |
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
- **Partes de trabajo**: Completamente funcional con persistencia en base de datos. Colores de texto por línea disponibles (6 opciones controladas).
- **Comunicaciones**: WhatsApp abre la app externa. Email y SMS solo generan texto para copiar.
- **Facturas — TicketBAI**: TicketBAI es un sistema fiscal implantado en los territorios históricos de Euskadi. Su aplicación depende del territorio, actividad y situación fiscal. Batuz es la implementación de Bizkaia. Verificar con la Hacienda Foral correspondiente o con un asesor.

## Modo demostración (DEMO_MODE)

Variable de servidor `DEMO_MODE=true` que activa datos ficticios para demostraciones comerciales.

**Características:**
- No escribe datos en la base de datos.
- El Dashboard muestra KPIs, alertas, facturas y visitas ficticias identificados con etiqueta "Modo demostración".
- Las facturas y visitas ficticias solo se devuelven cuando el Dashboard añade el parámetro context=dashboard-demo a las peticiones.
- Las páginas /facturas y /agenda continúan mostrando datos reales incluso con DEMO_MODE=true.
- Las operaciones de escritura (POST, PUT, DELETE) continúan trabajando con datos reales.
- Los enlaces demo conducen a páginas generales (/facturas, /presupuestos, /agenda), no a registros inexistentes.
- `DEMO_MODE=false` o ausente conserva el comportamiento real en todos los endpoints.
- No se expone al navegador (no es NEXT_PUBLIC).

**Módulos afectados en modo demo:**
- Dashboard: datos ficticios completos (KPIs, gráfico, alertas, top clientes).
- Facturas (solo GET con context=dashboard-demo): 5 facturas demo.
- Agenda (solo GET con context=dashboard-demo): 4 visitas demo.

Las páginas /facturas y /agenda NO muestran datos ficticios. Solo el Dashboard consume los datos demo.
