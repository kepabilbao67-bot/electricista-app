# Guía funcional de Autonomo360

## Qué es Autonomo360

Aplicación de gestión profesional para electricistas y autónomos. Permite gestionar clientes, presupuestos, facturas, gastos, agenda, materiales y más desde una sola herramienta.

## Acceso

La app está protegida por usuario y contraseña (Basic Auth). Se accede desde cualquier navegador.

## Módulos principales

### Dashboard (/)
Panel de control con KPIs financieros y comerciales, gráfico, alertas y acciones rápidas. Cuando DEMO_MODE=true, usa almacenamiento temporal aislado, bloquea escrituras y muestra la etiqueta “DEMO / SIN VALIDEZ FISCAL”.

### Clientes (/clientes)
Gestión de contactos y ficha 360 con oportunidades, tareas, historial, documentos y comunicación directa.

### CRM comercial (/crm)
Pipeline: nuevo → contactado → visita → presupuesto → aceptado → trabajo → facturado → cobrado. Incluye valor estimado, origen, próxima acción, tareas y recordatorios. Los cambios comerciales no alteran automáticamente estados fiscales.

### Leads (/leads)
Captación comercial. La acción de conversión crea de forma conjunta el cliente y su primera oportunidad CRM.

### Presupuestos (/presupuestos)
Creación con generador automático por zonas/estancias. Integración con catálogo. Conversión directa a factura.

### Facturas (/facturas)
Facturación con descuentos por línea, métodos de pago y estados. TicketBAI disponible para los territorios históricos de Euskadi (verificar aplicación con asesor). Solo se pueden eliminar facturas en estado Borrador que no tengan registro TicketBAI. Las facturas pendientes de Batuz, enviadas, cobradas o vencidas se conservan y no se pueden borrar.

### Partes de trabajo (/partes-trabajo)
Registro persistente de intervenciones con líneas de trabajo, materiales, relaciones con cliente/presupuesto/visita y vista imprimible.

### Gastos (/gastos)
Registro de compras con 12 categorías específicas de electricista.

### Agenda (/agenda)
Calendario semanal con visitas. Estados programada/completada/cancelada.

### Catálogo (/catalogo)
Materiales con precio de coste y venta. Calculadora de márgenes.

### Comunicaciones (/comunicaciones)
Plantillas genéricas editables para WhatsApp y otros canales. `wa.me` abre la aplicación externa; el sistema registra preparación manual y nunca afirma envío, entrega o lectura.

### Asistente (/normativa)
Chat con IA para normativa REBT, precios, negocio y seguridad.

### Exportar (/exportar)
Descarga de datos en CSV y backup JSON completo.
