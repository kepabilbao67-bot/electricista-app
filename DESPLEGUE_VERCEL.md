# 🚀 Guía de Despliegue en Producción — Vercel & Turso

Esta guía describe el procedimiento exacto paso a paso para desplegar **Autónomo 360 / Gestión Profesional 360** en la nube (Vercel) y conectarlo a una base de datos distribuida y segura (Turso LibSQL).

---

## 1. 🔑 Variables de Entorno Requeridas en Vercel

Configura estas variables en **Vercel Project Settings → Environment Variables**:

### A. Base de Datos (Obligatorias)
| Variable | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `TURSO_DATABASE_URL` | URL de conexión de Turso LibSQL | `libsql://tu-base-de-datos.turso.io` |
| `TURSO_AUTH_TOKEN` | Token de autenticación de Turso | `eyJh...` |

> *Nota: Si no se configuran, la aplicación utilizará un archivo SQLite local efímero (`electricista.db`), ideal para pruebas rápidas.*

### B. Identidad de la Aplicación y Marca (White-Label)
| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | Nombre general de la aplicación | `"Gestión Profesional 360"` |
| `NEXT_PUBLIC_APP_SHORT_NAME` | Nombre corto para icono PWA | `"Gestión 360"` |
| `NEXT_PUBLIC_THEME_COLOR` | Color primario de marca (HEX) | `"#2563eb"` |

### C. Datos Fiscales y de Cobro por Defecto (Opcionales, editables en `/configuracion`)
| Variable | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_COMPANY_TRADE_NAME` | Nombre comercial visible | `"Instalaciones y Servicios Pro"` |
| `NEXT_PUBLIC_COMPANY_LEGAL_NAME` | Razón Social o Titular | `"Instalaciones y Servicios Pro, S.L."` |
| `NEXT_PUBLIC_COMPANY_OWNER_NAME` | Administrador / Responsable | `"Juan Pérez"` |
| `NEXT_PUBLIC_COMPANY_NIF` | NIF / CIF de facturación | `"B12345678"` |
| `NEXT_PUBLIC_COMPANY_ADDRESS_1` | Dirección principal | `"Calle Mayor 10, 1º"` |
| `NEXT_PUBLIC_COMPANY_ADDRESS_2` | Código postal y ciudad | `"28001 Madrid"` |
| `NEXT_PUBLIC_COMPANY_PHONE` | Teléfono de contacto / WhatsApp | `"+34 600 000 000"` |
| `NEXT_PUBLIC_COMPANY_EMAIL` | Email de facturación | `"contacto@miempresa.com"` |
| `NEXT_PUBLIC_COMPANY_IBAN` | IBAN para cobros en facturas | `"ES00 0000 0000 0000 0000 0000"` |
| `NEXT_PUBLIC_COMPANY_BANK` | Nombre del banco | `"Banco Santander"` |
| `NEXT_PUBLIC_INVOICE_SERIES_PREFIX` | Prefijo serie facturas | `"FAC-"` |
| `NEXT_PUBLIC_BUDGET_SERIES_PREFIX` | Prefijo serie presupuestos | `"PRES-"` |

---

## 2. ⚡ Pasos para Desplegar en Vercel

1. **Crear o iniciar sesión en [Vercel](https://vercel.com)**.
2. Haz clic en el botón **"Add New..." → "Project"**.
3. Busca y selecciona el repositorio de GitHub:
   ```text
   kepabilbao67-bot/electricista-app
   ```
4. Configuración del proyecto:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./` (o dejar por defecto)
   - **Node.js Version**: `18.x` o superior
5. Despliega la sección **"Environment Variables"** y pega tus credenciales de Turso (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) y las variables de marca deseadas.
6. Haz clic en **"Deploy"**.
7. En ~60 segundos Vercel generará tu dominio de producción (ejemplo: `https://gestion-profesional.vercel.app`).

---

## 3. 📲 Instrucciones de Instalación PWA para el Cliente Final

Envía estas instrucciones a tus clientes para que disfruten de la experiencia de app nativa:

### 🍏 En iPhone / iPad (Safari):
1. Abre el enlace de la aplicación en el navegador **Safari**.
2. Pulsa el botón **Compartir** (icono cuadrado con flecha hacia arriba en la barra inferior).
3. Desplázate hacia abajo y selecciona **"Añadir a la pantalla de inicio"** (o *"Add to Home Screen"*).
4. Pulsa **Añadir**. El icono de la app aparecerá en tu pantalla de inicio y se abrirá sin barras de navegador.

### 🤖 En Android (Google Chrome):
1. Abre el enlace de la aplicación en **Google Chrome**.
2. Aparecerá un banner inferior o abre el **menú de 3 puntos** arriba a la derecha.
3. Pulsa en **"Instalar aplicación"** o **"Añadir a pantalla principal"**.
4. Confirma la instalación. La app se integrará directamente como cualquier aplicación nativa de Android.

---

## 4. 🖨️ Configuración Recomendada para Impresión de PDFs

Al guardar o imprimir Presupuestos, Partes o Facturas desde el navegador:
1. Pulsa **"Imprimir / Guardar PDF"**.
2. En la ventana de impresión del navegador:
   - **Destino**: `Guardar como PDF`
   - **Márgenes**: `Mínimos` o `Ninguno`
   - **Opciones**: Desmarcar *"Encabezados y pies de página"* del navegador (la app ya incluye su propio encabezado y pie profesional).
   - **Gráficos de fondo**: `Marcar casilla` (para asegurar colores y badges).
