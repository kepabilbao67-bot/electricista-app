# Guía funcional de Autonomo360

## Qué es Autonomo360

Aplicación de gestión profesional para electricistas y autónomos. Permite gestionar clientes, presupuestos, facturas, gastos, agenda, materiales y más desde una sola herramienta.

## Acceso

La app está protegida por usuario y contraseña (Basic Auth). Se accede desde cualquier navegador.

## Módulos principales

### Dashboard (/)
Panel de control con 6 KPIs, gráfico de facturación de los últimos 6 meses, alertas activas y acciones rápidas.

### Clientes (/clientes)
Gestión de contactos: crear, editar, eliminar. Tipos particular y empresa. Comunicación directa por WhatsApp, teléfono y email.

### Leads (/leads)
Pipeline de captación comercial. Estados: nuevo → contactado → cualificado → convertido/descartado. Los leads se guardan en base de datos. Marcar como convertido no crea automáticamente un cliente.

### Presupuestos (/presupuestos)
Creación con generador automático por zonas/estancias. Integración con catálogo. Conversión directa a factura.

### Facturas (/facturas)
Facturación con descuentos por línea, métodos de pago y estados. TicketBAI disponible para los territorios históricos de Euskadi (verificar aplicación con asesor).

### Partes de trabajo (/partes-trabajo)
Registro de intervenciones con vista imprimible. Estado: DEMO (no persiste datos).

### Gastos (/gastos)
Registro de compras con 12 categorías específicas de electricista.

### Agenda (/agenda)
Calendario semanal con visitas. Estados programada/completada/cancelada.

### Catálogo (/catalogo)
Materiales con precio de coste y venta. Calculadora de márgenes.

### Comunicaciones (/comunicaciones)
Plantillas para WhatsApp y email. No envía directamente (genera texto).

### Asistente (/normativa)
Chat con IA para normativa REBT, precios, negocio y seguridad.

### Exportar (/exportar)
Descarga de datos en CSV y backup JSON completo.
