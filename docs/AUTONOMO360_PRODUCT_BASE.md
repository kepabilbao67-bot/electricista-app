# Autonomo360 — Producto base vs. personalizacion cliente

## Contexto

Este repositorio (`electricista-app`) es la primera implementacion cliente de
Autonomo360, desarrollada para **S&H Electricas** (Ivan Martin Oyarzabal).

Autonomo360 es una plataforma SaaS para autonomos y pequenas empresas de
servicios. El codigo actual contiene tanto funcionalidad reutilizable del
producto base como personalizaciones especificas del cliente.

Este documento separa ambos conceptos para facilitar la extraccion futura de
modulos reutilizables.

---

## Funciones base reutilizables (Autonomo360)

Estas funcionalidades forman parte del producto base y pueden reutilizarse
para cualquier autonomo o negocio de servicios:

### Partes de trabajo
- Creacion, edicion y eliminacion de partes de trabajo.
- Lineas de mano de obra con descripcion, cantidad, unidad y precio.
- Lineas de materiales con descripcion, cantidad, unidad, precio coste y precio venta.
- Suma automatica de importes (subtotal mano de obra + subtotal materiales).
- Suma automatica de horas de trabajo.
- Descuento configurable.
- IVA configurable (21%, 10%, 4%, 0%).
- Base imponible y total calculados en tiempo real.

### Colores de texto
- Color por linea de trabajo (default, rojo, azul, verde, naranja, morado).
- Color en campos principales del parte (direccion, observaciones).
- Sistema seguro: solo className controlada, sin HTML libre ni estilos arbitrarios.
- Compatibilidad con partes antiguos (null = default).

### Plantilla imprimible
- Parte de trabajo optimizado para una hoja A4.
- Cabecera compacta con datos de empresa y numero de parte.
- Tabla de trabajos y materiales con colores respetados en impresion.
- Resumen economico compacto.
- Zona de firmas (operario + cliente).
- Texto legal minimo.

### Guardado y persistencia
- Guardado y reapertura manteniendo todos los datos y colores.
- Estrategia de reemplazo de lineas al editar (delete + re-insert atomico).
- Columnas opcionales anadidas con ensureColumns() sin migracion destructiva.

### Firma de producto
- Firma KepatecnologIA / KAOS en el producto.

---

## Personalizacion cliente (S&H Electricas)

Estas son configuraciones y datos especificos de este cliente que NO forman
parte del producto base:

### Identidad del negocio
- Nombre comercial: S&H Electricas.
- Operario por defecto: Ivan Martin Oyarzabal.
- Telefono: 609 421 750.
- Ubicacion: Bizkaia / Pais Vasco.

### Catalogo sectorial
- Catalogo de trabajos electricos (CATALOGO_TRABAJOS).
- Catalogo de materiales electricos (CATALOGO_MATERIALES).
- Unidades especificas del sector (punto de luz, metro de cable, etc.).

### Textos y terminologia
- Referencias a "cuadro electrico", "diferencial", "magnetotermico", etc.
- Plantillas de comunicacion orientadas al sector electrico.

---

## Regla de desarrollo

> Toda mejora funcional desarrollada para un cliente debe evaluarse como
> posible modulo reutilizable de Autonomo360.

Antes de implementar una funcionalidad nueva, preguntarse:

1. Es esto util para cualquier autonomo de servicios?
2. Se puede parametrizar para que no dependa del sector?
3. Requiere datos hardcoded o puede ser configurable?

Si la respuesta a (1) es si, implementar como modulo base. Si depende del
sector, implementar como modulo base con parametros configurables.

---

## Propuesta futura

> Configuracion por negocio para cambiar nombre, logo, sector, telefono,
> email, colores de marca y plantillas sin tocar codigo.

Objetivo: que un nuevo cliente de Autonomo360 pueda personalizar su instancia
desde un panel de configuracion, sin necesidad de fork ni modificacion de
codigo fuente.

Campos configurables propuestos:

| Campo | Ejemplo S&H | Ejemplo generico |
|-------|-------------|-----------------|
| Nombre comercial | S&H Electricas | Mi Empresa SL |
| Operario/tecnico | Ivan Martin | Nombre del autonomo |
| Telefono | 609 421 750 | Telefono del negocio |
| Email | — | email@negocio.com |
| Logo | — | URL/archivo |
| Sector | Electricidad | Fontaneria, Reformas, etc. |
| Colores de marca | Azul/slate | Personalizables |
| Catalogo | Electrico | Por sector o personalizado |
| Plantilla imprimible | A4 compacta | Seleccionable |

---

## Estado actual

| Componente | Estado |
|-----------|--------|
| Partes de trabajo | Producto base |
| Colores por linea | Producto base |
| Colores en campos | Producto base |
| Plantilla A4 | Producto base |
| Calculo automatico | Producto base |
| Nombre S&H | Personalizacion cliente |
| Catalogo electrico | Personalizacion cliente |
| Panel de configuracion | No implementado (futuro) |
