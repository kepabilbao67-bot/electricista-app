# 🚀 Guía de Inicio y Despliegue — SaaS Autónomo 360

¡Bienvenido a **Autónomo 360 / Gestión 360**! Esta solución SaaS White-Label ha sido diseñada para proporcionar a profesionales independientes, técnicos, instaladores y pequeñas empresas una herramienta integral, rápida y profesional para gestionar su ciclo comercial y operativo completo: **Presupuestos → Partes de Trabajo → Facturación → Cobros**.

---

## 🌟 Características Principales

1. **Gestión Comercial Integral:**
   - **Clientes & CRM:** Agenda de contactos, pipeline de oportunidades, seguimiento y tareas con recordatorio.
   - **Presupuestos In Situ:** Generación de presupuestos por zonas, cálculo de margen y envío en PDF o enlace directo.
   - **Partes de Trabajo en Movilidad:** Registro de intervenciones, control de horas, materiales y firma digital de conformidad.
   - **Facturación Automática:** Conversión en 1 clic desde presupuestos o partes, con desglose de impuestos y estados de cobro.

2. **White-Label Total:**
   - Personalización inmediata de nombre comercial, razón social, NIF, IBAN de cobro y logotipos.
   - Ajustes directos desde la pantalla `/configuracion` o mediante variables de entorno en el servidor.

3. **Tecnología PWA & Offline-First:**
   - Instalable en smartphones (iOS / Android) y escritorios como app nativa.
   - Funciona sin interrupciones incluso en zonas con cobertura intermitente.

4. **Asistente Inteligente Integrado:**
   - Consultas de catálogo, precios de venta con márgenes recomendados y soporte normativo y operativo.

---

## ⚙️ Puesta en Marcha Rápida (Despliegue en 3 Pasos)

### 1. Requisitos Previos
- Node.js 18+ instalado.
- Cuenta gratuita en [Turso Database](https://turso.tech) (o SQLite local para pruebas).

### 2. Configurar Variables de Entorno
Copia el archivo de ejemplo:
```bash
cp .env.example .env.local
```
Edita `.env.local` con tus datos de base de datos y marca:
```env
TURSO_DATABASE_URL=libsql://tu-base-de-datos.turso.io
TURSO_AUTH_TOKEN=tu-token-secreto

NEXT_PUBLIC_APP_NAME="Mi Empresa 360"
NEXT_PUBLIC_COMPANY_TRADE_NAME="Mi Empresa"
NEXT_PUBLIC_COMPANY_NIF="B12345678"
NEXT_PUBLIC_COMPANY_IBAN="ES00 0000 0000 0000 0000 0000"
NEXT_PUBLIC_COMPANY_PHONE="+34 600 000 000"
NEXT_PUBLIC_COMPANY_EMAIL="facturacion@miempresa.com"
```

### 3. Iniciar la Aplicación
```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build
npm run start
```
Abre tu navegador en `http://localhost:3000`.

---

## 📱 Instalación como App en el Móvil (PWA)

1. Abre la URL de tu aplicación en **Safari** (iPhone) o **Chrome** (Android).
2. En Safari: Pulsa el botón **Compartir** y selecciona **"Añadir a la pantalla de inicio"**.
3. En Chrome: Pulsa el menú de 3 puntos y selecciona **"Instalar aplicación"**.
4. ¡Listo! Ya tienes la app con icono propio y acceso a pantalla completa.

---

## 🔒 Seguridad y Copias de Seguridad

- **Exportación Total:** Desde el menú lateral en `/exportar` puedes descargar en cualquier momento un archivo JSON completo con todos tus clientes, facturas, presupuestos, partes y gastos.
- **Protección de Datos:** Todos los datos residen en tu propia base de datos cifrada.
