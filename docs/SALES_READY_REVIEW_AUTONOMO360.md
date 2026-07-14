# SALES-READY-001 — Revisión comercial de Autonomo360 / ElectricistApp

Fecha: 2025-07-14
Rama: `feature/sales-ready-001-audit`
Autor: Auditoría automatizada

---

## A. Estado actual de la app

### Módulos existentes

| Módulo | Ruta | Estado | Nivel |
|--------|------|--------|-------|
| Dashboard | `/` | Completo | Alto |
| Clientes | `/clientes` | Completo | Alto |
| Leads | `/leads` | Funcional (sin persistencia completa) | Medio |
| Facturas | `/facturas` | Completo + TicketBAI | Alto |
| Presupuestos | `/presupuestos` | Completo + generador por zonas | Alto |
| Partes de trabajo | `/partes-trabajo` | Funcional (datos demo) | Medio |
| Gastos | `/gastos` | Completo | Alto |
| Comunicaciones | `/comunicaciones` | Funcional | Medio |
| Agenda | `/agenda` | Completo (vista semanal + lista) | Alto |
| Catálogo | `/catalogo` | Completo + calculadora márgenes | Alto |
| Normativa | `/normativa` | IA + fallback offline | Alto |
| Exportar | `/exportar` | Funcional (CSV + JSON) | Medio |

### Qué está fuerte

1. **Dashboard**: 6 KPIs, gráfico mensual, alertas (facturas vencidas, presupuestos por caducar, visitas hoy), top clientes, acciones rápidas. Muy profesional.
2. **Presupuestos con zonas**: Generador automático por tipo de vivienda (piso/chalet/local), circuitos REBT, integración con catálogo. Diferenciador claro frente a competencia.
3. **Facturas**: CRUD completo, estados, descuentos por línea, duplicar, marcar como cobrada. Flujo profesional.
4. **Gastos**: Categorías rápidas específicas de electricista (material, gasolina, dietas, peajes), descuentos, NIF proveedor.
5. **Agenda**: Vista calendario semanal con horas + vista lista, estados de visita, integración Google Maps.
6. **Catálogo**: Precios de coste/venta, márgenes, calculadora, alimenta presupuestos y facturas.
7. **Normativa IA**: Asistente de REBT con sugerencias contextuales. Muy diferenciador para electricistas.
8. **Diseño visual**: Sistema de diseño coherente (Tailwind), animaciones, responsive, PWA-ready.
9. **Seguridad**: Basic Auth fail-closed en middleware. Protege toda la app.

### Qué parece incompleto

1. **Leads**: No hay persistencia real de conversiones (lead → cliente). Solo cambio de estado.
2. **Partes de trabajo**: Solo datos demo en memoria. No guarda en base de datos.
3. **Comunicaciones**: No envía realmente emails/SMS. Solo copia texto y genera enlace WhatsApp.
4. **Exportar**: Solo CSV/JSON. No genera PDF individuales desde aquí.
5. **Configuración de empresa**: No existe. Los datos de S&H Eléctricas están hardcodeados en el código.
6. **Multi-empresa**: No existe. Un solo usuario, un solo negocio.
7. **Logo**: Existe `/public/logo-sh-electricas.png` pero no se usa en header/sidebar.

### Qué puede fallar en una demo comercial

1. **Datos vacíos**: Si la base de datos está limpia, el dashboard muestra 0.00 EUR en todo. Impresión pobre.
2. **Nombre hardcodeado**: "Ivan Martin Oyarzabal" aparece en la sidebar. Un comprador ve datos de otra persona.
3. **Basic Auth**: El popup del navegador es feo. No hay pantalla de login real.
4. **Sin onboarding**: No hay configuración inicial, el usuario entra directamente al dashboard.
5. **Partes de trabajo en demo**: Funciona pero si intenta guardar un parte nuevo, no persiste tras refresh.
6. **Título del navegador**: "ElectricistApp" — no suena premium. Debería ser "Autonomo360" o configurable.

---

## B. Qué necesita para venderse

### 1. Impacto comercial ALTO / Esfuerzo BAJO

| Acción | Esfuerzo | Justificación |
|--------|----------|---------------|
| Datos demo precargados en dashboard | 2h | Primera impresión = venta o no venta |
| Quitar nombre personal de sidebar (hacerlo configurable) | 1h | Nadie quiere ver datos de otro |
| Mejorar título/meta del navegador | 15min | "Autonomo360 — Gestión para autónomos" |
| Añadir logo en sidebar/header | 30min | Ya existe el PNG, solo falta usarlo |
| Modo demo: botón "Cargar datos de ejemplo" | 3h | Permite enseñar la app llena |
| Quitar botón "Rellenar datos de prueba" en Leads | 15min | Parece prototipo |

### 2. Impacto comercial ALTO / Esfuerzo MEDIO

| Acción | Esfuerzo | Justificación |
|--------|----------|---------------|
| Pantalla de configuración de empresa | 4-6h | Nombre, NIF, teléfono, email, logo. Alimenta facturas/presupuestos/partes |
| Persistencia de partes de trabajo (DB) | 3-4h | Tabla leads ya existe como patrón. Replicar para partes |
| PDF de parte de trabajo (como facturas) | 3h | Electricistas necesitan dejar documento firmado al cliente |
| Landing interna "¿Qué es Autonomo360?" | 3h | Pantalla de ventas dentro de la propia app |
| Login con pantalla real (no Basic Auth popup) | 4h | Percepción de calidad 10x |

### 3. Impacto comercial ALTO / Esfuerzo ALTO

| Acción | Esfuerzo | Justificación |
|--------|----------|---------------|
| Multi-empresa / marca blanca | 15-20h | Vender a N electricistas con sus propios datos |
| App móvil (PWA instalable) | 8h | Ya es responsive. Falta service worker + install prompt |
| Firma digital en partes de trabajo | 6-8h | Canvas para firma en móvil + almacenamiento |
| Alertas push (cobros, caducidades) | 6h | Valor percibido alto para autónomos |
| Histórico/reporting por periodos | 8h | Trimestral/anual para contabilidad |

### 4. Riesgos técnicos o legales

| Riesgo | Gravedad | Mitigación |
|--------|----------|------------|
| Datos personales sin RGPD visible | Media | Añadir aviso legal y política de privacidad en footer |
| TicketBAI puede no estar homologado | Alta | NO tocar. Si se vende en Euskadi, verificar con asesor fiscal |
| Sin backup automático | Media | Turso tiene backups, pero el usuario no lo sabe |
| Sin HTTPS propio (depende de Vercel) | Baja | Vercel ya lo gestiona |
| Dependencia de Turso free tier | Media | Documentar límites y plan de pago |
| Sin términos de servicio | Alta para venta | Necesario antes de cobrar a terceros |

---

## C. Revisión visual

### Dashboard
- 6 KPIs con gradientes de color. Profesional.
- Gráfico de barras de facturación mensual. Bien.
- Alertas con iconos y colores. Bien.
- Quick actions con links. Bien.
- Problema: si no hay datos, queda vacío y pierde impacto.

### Menú (Sidebar)
- Diseño oscuro, gradientes, icono Zap. Profesional.
- 12 entradas de menú. Puede ser demasiado para primera impresión.
- Sin logo de empresa. Falta identidad.
- Nombre hardcodeado abajo. Problema para demo.

### Formularios
- Consistentes: `input-field`, `btn-primary`, `btn-secondary`.
- Validación básica (required). Suficiente para MVP.
- Sin mensajes de error inline en la mayoría.
- Bien adaptados a móvil.

### Presupuestos
- Generador por zonas es diferenciador. Muy bien.
- Vista detalle con conversión a factura. Completo.
- PDF imprimible. Profesional.

### Facturas
- CRUD completo. Estados visuales claros.
- Descuentos, métodos de pago, TicketBAI.
- Muy completo para MVP.

### Clientes
- Lista con búsqueda, tipo particular/empresa.
- Detalle con comunicaciones, facturas, visitas.
- WhatsApp directo. Bien pensado para electricistas.

### Agenda
- Vista semanal tipo Google Calendar. Impresiona.
- Vista lista alternativa. Bien.
- Estados de visita con colores.

### Servicios (Catálogo)
- CRUD con categorías y precios.
- Calculadora de márgenes. Diferenciador.
- Alimenta presupuestos automáticamente.

### Exportar
- 3 CSV + 1 JSON backup. Funcional.
- Instrucciones para importar en Excel/Sheets. Bien.
- Falta: exportación PDF de documentos.

### Responsive/móvil
- MobileNav con menú desplegable. Bien.
- Touch targets adecuados (44px mínimo).
- PWA meta tags presentes.
- Safe areas para notch.
- Print styles definidos.

---

## D. Revisión comercial

### Qué verá un comprador en los primeros 30 segundos

1. Popup de Basic Auth (mala primera impresión).
2. Dashboard con 6 KPIs — si hay datos, impresiona. Si está vacío, parece roto.
3. Sidebar con 12 opciones — puede abrumar.
4. Nombre de otra persona en la esquina inferior.

**Veredicto**: Si la demo tiene datos y se quita el popup de auth, los primeros 30 segundos son buenos. Sin datos, es catastrófico.

### Pantallas para enseñar al vender

1. **Dashboard** (con datos) — muestra que es completo.
2. **Presupuestos → Nuevo** — el generador por zonas es el wow factor.
3. **Facturas** — muestra que es un negocio real.
4. **Agenda** — "mira, tengo mi semana organizada".
5. **Normativa IA** — "tengo un asistente para REBT".
6. **Partes de trabajo** — "dejo parte firmado al cliente in situ".

### Textos que deberían sonar más profesionales

| Actual | Sugerido |
|--------|----------|
| "ElectricistApp" | "Autonomo360" o "Autonomo360 — Gestión Eléctrica" |
| "Gestion Profesional" (sin tilde) | "Gestión Profesional para Electricistas" |
| "Sin leads" (empty state) | "Aún no tienes leads. Añade tu primer contacto comercial." |
| "Rellenar datos de prueba" (botón) | Eliminar en producción |
| "Error de conexion" (sin tilde) | "Error de conexión. Revisa tu internet." |
| "Proximas tareas" (sin tilde) | "Próximas tareas" |

### Módulos que sobran o deberían ocultarse en demo

- **Normativa**: Muy bueno, pero si la IA no responde bien en demo, puede ser contraproducente. Opción: modo offline con respuestas predefinidas.
- **Exportar**: Útil pero no vende. Mover al final o a menú secundario.
- **Leads**: Si está vacío, no aporta. Precargarlo o esconderlo.

### Módulos que faltan para electricistas

1. **Configuración de empresa** — todo autónomo quiere ver SU nombre, SU logo.
2. **Alertas de cobro** — "Te deben 3.500€ de hace 30 días".
3. **Informes trimestrales** — para el gestor/asesor fiscal.
4. **Firma digital en partes** — firmar con el dedo en el móvil del cliente.
5. **Fotos de trabajo** — antes/después de instalaciones (muy pedido en el sector).

---

## E. Módulos recomendados para versión vendible

| # | Módulo | Estado actual | Prioridad |
|---|--------|---------------|-----------|
| 1 | Dashboard comercial | Existe, falta datos demo | P1 |
| 2 | Clientes | Completo | OK |
| 3 | Presupuestos | Completo + zonas | OK |
| 4 | Facturas | Completo | OK |
| 5 | Partes de trabajo | Demo sin DB | P2 |
| 6 | Agenda/visitas | Completo | OK |
| 7 | Catálogo servicios/materiales | Completo | OK |
| 8 | Exportación PDF | Parcial (solo print) | P3 |
| 9 | Alertas cobro/caducidad | Dashboard tiene algo | P3 |
| 10 | Modo demo | No existe | P1 |
| 11 | Configuración de empresa | No existe | P1 |
| 12 | Branding S&H Eléctricas | Parcial (logo existe, no se usa) | P2 |
| 13 | Multi-empresa / marca blanca | No existe | P4 |

---

## F. Plan de trabajo por PRs

### PR 1 — Pulido visual dashboard demo
- Precargar datos demo realistas cuando DB está vacía.
- Corregir tildes en textos del dashboard.
- Mostrar logo en sidebar.
- Quitar nombre hardcodeado o hacerlo genérico.
- Esfuerzo: 3-4h.

### PR 2 — Integrar partes de trabajo (merge PR #27)
- Mergear PR existente.
- Añadir persistencia en DB (tabla work_orders).
- Conectar con clientes existentes.
- Esfuerzo: 4-5h.

### PR 3 — Configuración de empresa/branding
- Nueva ruta `/configuracion`.
- Formulario: nombre empresa, NIF, teléfono, email, dirección, logo.
- Guardar en tabla `settings` (key-value).
- Usar en facturas, presupuestos y partes de trabajo.
- Esfuerzo: 5-6h.

### PR 4 — Modo demo comercial
- Botón "Cargar demo" en configuración o primer acceso.
- Inserta: 5 clientes, 3 facturas, 2 presupuestos, 4 visitas, 1 parte de trabajo.
- El dashboard se ve lleno y profesional.
- Esfuerzo: 3-4h.

### PR 5 — Mejorar PDFs/documentos
- Unificar estilos print en facturas, presupuestos y partes.
- Añadir logo de empresa en cabecera.
- Mejorar pie con datos fiscales.
- Esfuerzo: 3h.

### PR 6 — Landing interna "Qué hace esta app"
- Ruta `/info` o modal de bienvenida.
- Lista de funcionalidades con capturas.
- Botón "Empezar configuración".
- Para enseñar en venta.
- Esfuerzo: 3h.

### PR 7 — Preparar multi-autónomo/marca blanca
- Abstraer datos de empresa a tabla settings.
- Permitir cambiar colores/logo desde config.
- Documentar despliegue por empresa.
- Esfuerzo: 12-15h.

### PR 8 — QA final venta
- Revisar todos los textos (tildes, profesionalidad).
- Probar flujo completo: crear cliente → presupuesto → factura → cobrar.
- Verificar responsive en iPhone/Android.
- Verificar print/PDF en todos los módulos.
- Esfuerzo: 4-6h.

---

## G. Decisión recomendada

**Ejecutar primero: PR 1 + PR 4 (Pulido dashboard + Modo demo)**

Razón: El 80% de la decisión de compra ocurre en los primeros 30 segundos. Si el comprador ve un dashboard vacío con 0.00 EUR, cierra la pestaña. Si ve un dashboard lleno con datos realistas de electricista, sigue explorando.

Estas dos PRs combinadas:
- No tocan la lógica de negocio.
- No modifican la base de datos en producción.
- No afectan a módulos existentes.
- Son reversibles.
- Se ejecutan en 6-8h totales.
- Multiplican x10 la percepción de calidad en demo.

**Segundo bloque**: PR 3 (Configuración de empresa). Sin esto, la app no se puede vender a un segundo autónomo.

**Tercer bloque**: PR 2 (Partes de trabajo con DB). Es el módulo más pedido por electricistas de campo y ya está construido a nivel UI.

---

## Notas finales

- NO se toca TicketBAI.
- NO se tocan facturas fiscales.
- NO se toca auth/middleware (excepto opcionalmente en PR futura de login visual).
- NO se toca BUD-SINCLIENTE-001 ni PR #26.
- Todo lo propuesto es aditivo, no destructivo.
- La app tiene una base técnica sólida. El problema no es código, es presentación.
