# 🛠️ Guía del Panel de Configuración (/configuracion)

El panel de **Configuración** permite a los administradores y propietarios del negocio personalizar todos los datos comerciales, fiscales y bancarios que aparecen en la plataforma y en los documentos generados (Presupuestos, Partes de Trabajo y Facturas).

---

## 📍 Acceso al Panel

1. Inicia sesión en la aplicación.
2. En el menú lateral izquierdo (o menú inferior en móvil), pulsa en el icono de engranaje **Configuración** (`/configuracion`).

---

## 📋 Secciones Disponibles

### 1. Identidad de Empresa
- **Nombre comercial:** Es el nombre que verán los clientes en la cabecera de la aplicación y en los mensajes (ej: *Instalaciones Eléctricas Pro*).
- **Razón Social / Titular:** Razón jurídica o nombre completo del profesional para facturación oficial (ej: *Instalaciones Eléctricas Pro, S.L.*).
- **Responsable / Administrador:** Nombre de la persona de contacto o gerente.
- **NIF / CIF:** Número de identificación fiscal oficial de la empresa o autónomo.

### 2. Dirección y Contacto
- **Dirección principal:** Calle, número, piso y puerta.
- **Código Postal y Ciudad / Provincia:** Datos de ubicación para presupuestos y facturas.
- **Teléfono de atención:** Teléfono que se incluye en los encabezados y enlaces directos de WhatsApp.
- **Email de facturación:** Correo electrónico desde el que se gestionan los envíos de presupuestos y facturas.

### 3. Datos Bancarios para Cobros
- **Entidad Bancaria:** Nombre de tu banco (ej: *BBVA, Santander, CaixaBank*).
- **IBAN Completo:** Número de cuenta donde los clientes realizarán las transferencias bancarias. Aparece al pie de todas las facturas emitidas.

### 4. Series de Documentos & Impuestos
- **Serie de Facturas:** Prefijo para las facturas automáticas (por defecto: `FAC-`).
- **Serie Presupuestos:** Prefijo para presupuestos (por defecto: `PRES-`).
- **IVA por defecto (%):** Porcentaje de IVA predeterminado aplicado al crear presupuestos y facturas (por defecto: `21%`).

---

## 💾 Guardar y Aplicar Cambios

1. Una vez rellenados o modificados los campos, pulsa el botón **"Guardar cambios"** situado en la parte superior derecha o al pie de la vista previa.
2. Aparecerá una notificación verde confirmando que los datos se han guardado con éxito.
3. Los cambios se aplicarán de forma inmediata y automática en:
   - Encabezados de presupuestos (`/presupuestos/[id]`)
   - Encabezados y pie de cobro de facturas (`/facturas/[id]`)
   - Cabecera y plantilla de partes de trabajo (`/partes-trabajo/[id]`, `/partes-trabajo/plantilla`)
   - Asistente virtual y mensajes preparados.
