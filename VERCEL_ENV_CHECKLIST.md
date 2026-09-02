# 📋 Checklist Maestro de Variables de Entorno para Vercel

Este documento contiene la lista exacta de variables de entorno para configurar en **Vercel** (`Project Settings → Environment Variables`), separadas por nivel de obligatoriedad, con sus valores recomendados e instrucciones de copia directa.

---

## 🔴 1. Variables OBLIGATORIAS (Producción con Persistencia)

Estas variables conectan la aplicación a tu base de datos en la nube (Turso LibSQL). Sin ellas, la aplicación funcionará en modo SQLite local efímero.

| Variable | Tipo | Valor / Ejemplo | Descripción |
| :--- | :--- | :--- | :--- |
| `TURSO_DATABASE_URL` | String | `libsql://mi-empresa-app-org.turso.io` | URL de tu base de datos Turso |
| `TURSO_AUTH_TOKEN` | Secret | `eyJhbGciOi...` | Token de acceso generado en Turso CLI o Dashboard |

---

## 🟡 2. Variables RECOMENDADAS (White-Label y Personalización de Marca)

Personalizan la aplicación para el cliente final en su primer despliegue.

| Variable | Valor por Defecto Recomendado | Descripción |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | `"Gestión Profesional 360"` | Nombre del SaaS visible en cabecera y títulos |
| `NEXT_PUBLIC_APP_SHORT_NAME` | `"Gestión 360"` | Nombre mostrado bajo el icono en smartphones (PWA) |
| `NEXT_PUBLIC_THEME_COLOR` | `"#2563eb"` | Color de tema PWA y barra de estado móvil |
| `NEXT_PUBLIC_COMPANY_TRADE_NAME` | `"Mi Empresa"` | Nombre comercial de la empresa cliente |
| `NEXT_PUBLIC_COMPANY_LEGAL_NAME` | `"Mi Empresa Servicios S.L."` | Razón social oficial para presupuestos y facturas |
| `NEXT_PUBLIC_COMPANY_OWNER_NAME` | `"Responsable del Servicio"` | Nombre del titular o administrador |
| `NEXT_PUBLIC_COMPANY_NIF` | `"B00000000"` | NIF / CIF de facturación |
| `NEXT_PUBLIC_COMPANY_ADDRESS_1` | `"Calle Principal 123"` | Dirección comercial línea 1 |
| `NEXT_PUBLIC_COMPANY_ADDRESS_2` | `"28001 Madrid"` | Código postal y localidad línea 2 |
| `NEXT_PUBLIC_COMPANY_PHONE` | `"+34 600 000 000"` | Teléfono para cabeceras y WhatsApp |
| `NEXT_PUBLIC_COMPANY_EMAIL` | `"contacto@miempresa.com"` | Email para facturación y presupuestos |
| `NEXT_PUBLIC_COMPANY_IBAN` | `"ES00 0000 0000 0000 0000 0000"` | IBAN para pagos por transferencia bancaria |
| `NEXT_PUBLIC_COMPANY_BANK` | `"Banco Principal"` | Nombre del banco para facturas |
| `NEXT_PUBLIC_INVOICE_SERIES_PREFIX` | `"FAC-"` | Prefijo de serie de facturas |
| `NEXT_PUBLIC_BUDGET_SERIES_PREFIX` | `"PRES-"` | Prefijo de serie de presupuestos |
| `NEXT_PUBLIC_WORK_ORDER_SERIES_PREFIX` | `"PT-"` | Prefijo de serie de partes de trabajo |
| `NEXT_PUBLIC_DEFAULT_TAX_RATE` | `"21"` | Porcentaje de IVA por defecto |

---

## 🟢 3. Variables OPCIONALES (Seguridad & Funcionalidades Avanzadas)

| Variable | Valor / Ejemplo | Propósito |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | `sk-...` | Activa respuestas con IA generativa avanzada en el Asistente |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modelo de OpenAI utilizado por el asistente |
| `APP_BASIC_AUTH_USER` | `admin` | Usuario si deseas proteger toda la web con contraseña |
| `APP_BASIC_AUTH_PASSWORD` | `claveSecreta360` | Contraseña para protección HTTP Basic Auth |
| `HEALTH_CHECK_SECRET` | `tokenDiagnostico` | Clave para proteger el endpoint `/api/health/db` |
| `EXPORT_SECRET` | `tokenExport` | Clave para proteger endpoints de exportación masiva |

---

## 📋 4. Bloque para Copiar y Pegar en Vercel (Raw Key-Value)

Puedes copiar este bloque directamente en la opción **"Paste .env"** de Vercel:

```env
TURSO_DATABASE_URL=libsql://tu-base-datos.turso.io
TURSO_AUTH_TOKEN=tu-token-de-turso
NEXT_PUBLIC_APP_NAME="Gestión Profesional 360"
NEXT_PUBLIC_APP_SHORT_NAME="Gestión 360"
NEXT_PUBLIC_THEME_COLOR="#2563eb"
NEXT_PUBLIC_COMPANY_TRADE_NAME="Mi Empresa"
NEXT_PUBLIC_COMPANY_LEGAL_NAME="Mi Empresa Servicios S.L."
NEXT_PUBLIC_COMPANY_OWNER_NAME="Responsable del Servicio"
NEXT_PUBLIC_COMPANY_NIF="B00000000"
NEXT_PUBLIC_COMPANY_ADDRESS_1="Calle Principal 123"
NEXT_PUBLIC_COMPANY_ADDRESS_2="28001 Madrid"
NEXT_PUBLIC_COMPANY_PHONE="+34 600 000 000"
NEXT_PUBLIC_COMPANY_EMAIL="contacto@miempresa.com"
NEXT_PUBLIC_COMPANY_IBAN="ES00 0000 0000 0000 0000 0000"
NEXT_PUBLIC_COMPANY_BANK="Banco Principal"
NEXT_PUBLIC_INVOICE_SERIES_PREFIX="FAC-"
NEXT_PUBLIC_BUDGET_SERIES_PREFIX="PRES-"
NEXT_PUBLIC_WORK_ORDER_SERIES_PREFIX="PT-"
NEXT_PUBLIC_DEFAULT_TAX_RATE=21
```

---

## 🛠️ 5. Procedimiento Rápido en Vercel

1. Ve a **Vercel** → Selecciona tu Proyecto → **Settings** → **Environment Variables**.
2. Haz clic en el recuadro **"Paste variables directly..."**.
3. Pega el bloque anterior y pulsa **Save**.
4. Haz un nuevo despliegue o pulsa **Redeploy** en el menú de Deployments para aplicar las variables.
Agent
Autonomo3