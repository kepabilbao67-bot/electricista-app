// Base de conocimiento ampliada del asistente IA para electricistas
// Cubre: normativa REBT completa, negocio/fiscalidad, seguridad, herramientas,
// tramites administrativos, calculos electricos, averias, domotica, fotovoltaica,
// vehiculo electrico y consejos practicos de gestion.

export interface KnowledgeTopic {
  keywords: RegExp;
  response: string;
}

export const KNOWLEDGE_BASE: KnowledgeTopic[] = [
  // ============ NORMATIVA REBT AMPLIADA ============
  {
    keywords: /locales.*humed|bano.*volumen|itc.*27|volumen.*seguridad/,
    response: `**Locales húmedos y baños (ITC-BT-27):**

**Volúmenes de seguridad en baños:**
- **Volumen 0**: dentro de bañera/ducha. Solo 12V SELV, IP67
- **Volumen 1**: hasta 2.25m altura sobre volumen 0. IP24, solo aparatos fijos
- **Volumen 2**: 0.6m alrededor del volumen 1. IP24, tomas con transformador
- **Volumen 3**: resto del baño. Enchufes con diferencial 30mA

**Reglas clave:**
- Prohibido cuadros eléctricos en volumen 0, 1 y 2
- Mecanismos en volumen 2: IPX4 mínimo
- Conexión equipotencial obligatoria (tuberías metálicas, radiador...)
- Luminarias clase II preferentemente

Precio orientativo instalación baño completo: enchufes húmedos + interruptores + focos ≈ 250-300€`,
  },
  {
    keywords: /piscina|itc.*24/,
    response: `**Piscinas (ITC-BT-24):**

**Volúmenes de seguridad:**
- **Volumen 0**: interior del vaso
- **Volumen 1**: hasta 2m del borde y 2.5m altura
- **Volumen 2**: 1.5m adicionales del volumen 1

**Requisitos:**
- Diferencial 30mA obligatorio en todos los circuitos
- Bomba de depuración con conexión equipotencial
- Luminarias sumergidas: 12V SELV o transformador de seguridad
- Cuadro específico fuera de volúmenes 0, 1 y 2
- Conexión equipotencial de estructura metálica y escaleras

Es un trabajo especializado - factura con precio premium (300-800€ según complejidad).`,
  },
  {
    keywords: /garaje|aparcamiento|itc.*29/,
    response: `**Garajes y aparcamientos (ITC-BT-29):**

- Clasificación como local con riesgo de incendio (humedad, vehículos)
- Instalación empotrada o superficie con IP mínimo 4X
- Ventilación mecánica: alumbrado de emergencia obligatorio si es de pública concurrencia
- Punto de recarga vehículo eléctrico: circuito independiente (ver "cargador coche")
- Diferencial 30mA en todos los circuitos
- Tomas de corriente a 1.5m mínimo del suelo si hay riesgo de lavado`,
  },
  {
    keywords: /local.*comercial|publica.*concurrencia|itc.*28/,
    response: `**Locales de pública concurrencia (ITC-BT-28):**

**Obligatorio:**
- Alumbrado de emergencia (autonomía mínima 1 hora)
- Cuadro general con cerradura, accesible solo a personal autorizado
- Circuito de alumbrado normal + circuito de emergencia independiente
- Fuente de alimentación centralizada o luminarias autónomas
- Señalización de salidas de emergencia
- Diferencial selectivo tipo S en cabecera + diferenciales instantáneos por circuito

**Ejemplos:** bares, restaurantes, tiendas, gimnasios, locales de espectáculos.

Este tipo de instalación necesita boletín + proyecto si supera cierta potencia (>100kW o pública concurrencia con aforo elevado).`,
  },
  {
    keywords: /obra|construccion|itc.*33/,
    response: `**Instalaciones provisionales de obra (ITC-BT-33):**

- Cuadro de obra normalizado (IP44 mínimo), con cerradura
- Diferencial 30mA en cada circuito de tomas
- Diferencial 300mA en cabecera si hay maquinaria de potencia
- Toma de tierra independiente con pica propia
- Cables mangueras tipo RV-K resistentes a la intemperie
- Revisión periódica documentada (cada obra larga)

Tarifa orientativa: instalación cuadro de obra completo 400-600€ según potencia.`,
  },
  {
    keywords: /agricola|granja|itc.*30/,
    response: `**Instalaciones agrícolas y ganaderas (ITC-BT-30):**

- Ambiente polvoriento/corrosivo: IP mínimo 55
- Protección contra corrosión en todos los elementos metálicos
- Diferencial 30mA obligatorio
- Cableado con protección mecánica reforzada
- Puesta a tierra reforzada por ambiente húmedo`,
  },

  // ============ CALCULOS ELECTRICOS ============
  {
    keywords: /ley.*ohm|calcular.*intensidad|calcular.*potencia|f[oó]rmula.*electric/,
    response: `**Fórmulas eléctricas básicas:**

**Ley de Ohm:** V = I × R
- V = tensión (voltios) | I = intensidad (amperios) | R = resistencia (ohmios)

**Potencia monofásica:** P = V × I × cos(φ)
- P en vatios, V=230V, cos(φ) ≈ 0.9-1 en resistivo

**Potencia trifásica:** P = √3 × V × I × cos(φ)
- V = 400V (línea), cos(φ) según carga

**Calcular intensidad desde potencia (monofásico):**
I = P / (V × cos φ) = P / (230 × 0.9)

**Ejemplo:** Horno de 3500W monofásico:
I = 3500 / (230 × 1) = 15.2A → usar magnetotérmico de 20A y cable 2.5-4mm²

**Calcular sección por intensidad:** usa la tabla ITC-BT-19 (pregúntame "secciones de cable")`,
  },
  {
    keywords: /potencia.*contratada|cambiar.*potencia|kw.*contrata/,
    response: `**Potencias normalizadas para contratar (según ICP):**

| Potencia | ICP/IGA | Uso tipico |
|----------|---------|------------|
| 3.45 kW | 15A | Piso pequeño sin electrodomesticos grandes |
| 4.6 kW | 20A | Piso estandar basico |
| 5.75 kW | 25A | Piso electrificacion basica (mas habitual) |
| 6.9 kW | 30A | Piso con mas electrodomesticos |
| 9.2 kW | 40A | Chalet/piso electrificacion elevada |
| 11.5 kW | 50A | Vivienda grande con calefaccion electrica |
| 14.49 kW | 63A | Chalet grande, con A/C multiple |

El cliente elige la potencia con la comercializadora. Tu instalación (ICP/IGA del cuadro) debe coincidir o ser compatible.`,
  },
  {
    keywords: /factor.*potencia|cos.*fi|cos.*phi/,
    response: `**Factor de potencia (cos φ):**

Relación entre potencia activa (útil) y potencia aparente.

- **Resistivo puro** (bombillas incandescentes, resistencias): cos φ ≈ 1
- **LED/electrónica**: cos φ ≈ 0.9-0.95
- **Motores**: cos φ ≈ 0.7-0.85 (inductivo)
- **Fluorescentes sin corregir**: cos φ ≈ 0.5

Un cos φ bajo penaliza en la factura eléctrica (reactiva). Para instalaciones industriales con motores, se recomienda batería de condensadores para corregir el factor de potencia.`,
  },

  // ============ SEGURIDAD Y PRL ============
  {
    keywords: /epi|equipo.*proteccion|seguridad.*trabajo|riesgo.*electric/,
    response: `**Equipos de Protección Individual (EPIs) para electricista:**

**Obligatorios:**
- Guantes dieléctricos (clase según tensión de trabajo)
- Calzado de seguridad aislante (sin componentes metálicos)
- Casco dieléctrico si hay riesgo de caída de objetos
- Gafas de protección para corte/taladro
- Ropa de trabajo ignífuga (arco eléctrico) en instalaciones de BT/MT

**Herramientas aisladas:**
- Destornilladores, alicates y llaves con aislamiento 1000V
- Comprobador de tensión (buscapolos) VAT (Voltage Absence Tester)
- Pértiga de maniobra si trabajas cerca de MT

**5 reglas de oro antes de trabajar sin tensión:**
1. Abrir el circuito (desconectar)
2. Enclavamiento/bloqueo del elemento de corte
3. Verificar ausencia de tensión (VAT)
4. Poner a tierra y en cortocircuito
5. Delimitar la zona de trabajo con señalización`,
  },
  {
    keywords: /electrocuci[oó]n|accidente.*electric|primeros.*auxilios/,
    response: `**Actuación ante accidente eléctrico:**

1. **NO tocar directamente** a la víctima si sigue en contacto con la corriente
2. Cortar la alimentación (interruptor general) o separar con material aislante (madera, plástico)
3. Llamar al 112 inmediatamente
4. Si no respira: iniciar RCP (reanimación cardiopulmonar)
5. Si hay quemaduras: no aplicar cremas, cubrir con gasa estéril
6. Mantener a la víctima abrigada y en reposo hasta que llegue ayuda

**Importante:** las quemaduras eléctricas pueden ser internas y más graves de lo que parece por fuera. Siempre trasladar a urgencias aunque parezca leve.`,
  },
  {
    keywords: /arco.*electrico|flash.*electric/,
    response: `**Riesgo de arco eléctrico:**

Se produce al abrir/cerrar circuitos con carga o por cortocircuito. Puede generar temperaturas de hasta 20.000°C.

**Prevención:**
- Trabajar sin tensión siempre que sea posible (5 reglas de oro)
- Si hay que maniobrar en carga: ropa ignífuga clase adecuada
- Mantener distancia de seguridad
- Usar EPI facial certificado para arco eléctrico en cuadros de gran potencia`,
  },

  // ============ NEGOCIO Y FISCALIDAD AUTONOMOS ============
  {
    keywords: /irpf|retencion|hacienda|declaracion.*renta/,
    response: `**IRPF y retenciones para autónomos:**

- Si facturas a **particulares**: sin retención, tú pagas el IRPF trimestral (modelo 130)
- Si facturas a **empresas**: normalmente sin retención en instalaciones (no es servicio profesional, es prestación de obra/material) - consulta con tu gestor
- **Modelo 130**: pago fraccionado IRPF trimestral (20% del beneficio neto aprox.)
- **Modelo 303**: IVA trimestral (repercutido - soportado)
- **Modelo 390**: resumen anual IVA
- **Declaración renta anual**: antes del 30 de junio

Guarda TODAS las facturas de gastos (Sokoel, gasolina, herramientas) - son deducibles y reducen tu base imponible. Usa la sección **Gastos** de esta app para llevarlo controlado.`,
  },
  {
    keywords: /cuota.*autonomo|seguridad.*social.*autonomo|tarifa.*plana/,
    response: `**Cuota de autónomos (RETA) 2026:**

Desde 2023 se paga según **rendimientos netos reales** (tramos):
- Tramos aproximados desde ~200€/mes (rendimientos bajos) hasta ~590€/mes (rendimientos altos)
- Se ajusta según lo que declares que vas a ganar, con regularización anual

**Tarifa plana nuevos autónomos:** 
- Primeros 12 meses: cuota reducida (~80€/mes aprox, revisar importe vigente)
- Siguientes 12 meses (si rendimientos bajos): mantiene reducción

Consulta con tu gestoría los importes exactos vigentes, cambian cada año.`,
  },
  {
    keywords: /como.*cobrar|calcular.*presupuesto|margen.*beneficio.*negocio|cuanto.*gano/,
    response: `**Cómo calcular bien tus precios (mano de obra + material):**

**Fórmula básica:**
Precio venta = Coste material × (1 + margen%) + Mano de obra

**Mano de obra recomendada:**
- Precio hora electricista autónomo: 25-40€/hora según zona (Bizkaia tiende a la parte alta)
- Calcula tiempo real + desplazamiento + imprevistos (+20%)

**Margen en material:**
- Material básico (cable, tubo): 80-100% margen
- Material específico (mecanismos, protecciones): 60-100%
- Material caro (cargadores, cuadros grandes): 30-50% (competitividad)

**No olvides incluir en el presupuesto:**
- Desplazamientos si la obra está lejos
- Tiempo de gestión (Batuz, TicketBAI, permisos)
- Imprevistos de obra (+10-15% de margen de seguridad)

Usa la **Calculadora de precios** (Catálogo → Calculadora) para hacer esto automáticamente con tus datos reales.`,
  },
  {
    keywords: /moroso|no.*paga|impago|reclamar.*factura/,
    response: `**Qué hacer con clientes morosos:**

1. **Antes de empezar el trabajo:** pide señal/anticipo (30-50%) en trabajos grandes
2. **Recordatorio amable:** usa la plantilla de "Recordatorio de pago" en Comunicaciones
3. **Si no paga en 30-60 días:** carta de requerimiento formal por escrito (burofax si es necesario)
4. **Vía judicial:** proceso monitorio (deudas documentadas, hasta 250.000€) - no necesitas abogado si es menor de 2.000€
5. **Intereses de demora:** puedes reclamar según Ley 3/2004 de morosidad (interés legal + margen)

**Prevención:** siempre presupuesto firmado + factura con plazo de pago claro + datos bancarios visibles.`,
  },
  {
    keywords: /ayuda.*autonomo|subvencion|kit.*digital/,
    response: `**Ayudas para autónomos y pymes en Euskadi/Bizkaia:**

- **Kit Digital** (fondos UE): ayudas para digitalización, web, facturación electrónica
- **SPRI (Gobierno Vasco)**: programas de apoyo a pymes, digitalización, eficiencia energética
- **Diputación Foral de Bizkaia**: líneas de ayuda para autónomos y microempresas
- **Cámara de Comercio de Bilbao**: asesoramiento gratuito, formación
- **Bonos de eficiencia energética**: para instalaciones renovables/autoconsumo

Consulta bizkaia.eus y spri.eus para convocatorias actualizadas - cambian cada año.`,
  },

  // ============ TRAMITES ADMINISTRATIVOS ============
  {
    keywords: /boletin.*electric|certificado.*instalacion|CIE/,
    response: `**Boletín eléctrico / Certificado de Instalación Eléctrica (CIE):**

Documento obligatorio que certifica que la instalación cumple el REBT. Lo emites tú como instalador autorizado.

**Cuándo se necesita:**
- Nueva instalación
- Ampliación de potencia
- Reforma que afecte al cuadro/circuitos
- Cambio de titularidad con inspección

**Trámite en Bizkaia:**
1. Rellenar el certificado (papel oficial o vía online del Gobierno Vasco/Ente Vasco de la Energía)
2. Presentar en registro de instalaciones eléctricas (Delegación de Industria)
3. Si supera potencia límite: requiere inspección OCA antes de la puesta en servicio
4. El cliente lo necesita para dar de alta el contrato con la comercializadora

Guárdalo siempre firmado y con copia para el cliente y para ti.`,
  },
  {
    keywords: /oca|inspeccion.*periodica|inspeccion.*obligatoria/,
    response: `**Inspecciones OCA (Organismo de Control Autorizado):**

**Cuándo es obligatoria:**
- Instalaciones nuevas de electrificación elevada o superior a cierta potencia
- Locales de pública concurrencia
- Instalaciones industriales
- Revisión periódica cada 5-10 años según tipo

**Instalaciones NO sujetas a inspección inicial:**
- Viviendas de electrificación básica (normalmente basta el boletín)

El cliente contrata la OCA (tú puedes recomendarle una) y tú como instalador debes estar presente o disponible para resolver defectos que se detecten.`,
  },
  {
    keywords: /carnet.*instalador|autorizacion.*instalador|REI/,
    response: `**Carnet de instalador electricista (REI - Registro de Instalador):**

Para poder firmar boletines necesitas:
1. **Certificado de cualificación individual (CIS/CI)**: formación reglada (FP grado medio/superior en electricidad, o experiencia demostrable)
2. **Inscripción como Instalador Autorizado** en el registro industrial del Gobierno Vasco
3. **Renovación periódica** con formación continua en algunas categorías

Categorías: BT (baja tensión) básica/especialista, según el tipo de instalaciones que quieras certificar.

Trámite en: Departamento de Desarrollo Económico del Gobierno Vasco / Delegación Territorial de Industria.`,
  },

  // ============ HERRAMIENTAS ============
  {
    keywords: /herramientas.*necesito|kit.*herramientas|que.*comprar.*empezar/,
    response: `**Herramientas básicas de electricista:**

**Imprescindibles:**
- Destornilladores aislados (planos y estrella, varios tamaños)
- Alicates de corte, punta y universal aislados
- Pelacables/pelahilos
- Multímetro digital (voltios, amperios, continuidad)
- Buscapolos/comprobador de tensión (VAT)
- Pinza amperimétrica
- Crimpadora de terminales
- Nivel láser o de burbuja
- Rotulador para cuadros

**Para instalación:**
- Taladro percutor + brocas
- Rozadora (para picar paredes)
- Aspirador de obra
- Cinta métrica, caladora

**Herramienta de gama:** marcas recomendadas: Wera, Knipex, Fluke (multímetro), Bosch/Makita (eléctricas)

Metelas en **Gastos → Herramientas** para llevar el control de la inversión.`,
  },
  {
    keywords: /multimetro|medir.*tension|comprobar.*continuidad/,
    response: `**Uso del multímetro:**

**Medir tensión (voltios):**
- Selector en V~ (AC) para 230V/400V
- Puntas en paralelo con el circuito (sin cortar)

**Medir intensidad (amperios):**
- Selector en A, mejor usar pinza amperimétrica (no corta el circuito)
- Multímetro normal: hay que abrir el circuito y poner en serie (cuidado, riesgo)

**Comprobar continuidad:**
- Selector en modo continuidad (símbolo diodo/pitido)
- SIN TENSIÓN en el circuito
- Pita si hay paso (0 ohmios), útil para detectar cables cortados o fusibles fundidos

**Medir resistencia de tierra:**
- Necesitas un telurómetro específico, no un multímetro normal`,
  },

  // ============ DOMOTICA Y NUEVAS TECNOLOGIAS ============
  {
    keywords: /domotica|knx|smart.*home|casa.*inteligente/,
    response: `**Domótica / KNX (ITC-BT-51):**

**Sistemas más comunes:**
- **KNX**: estándar europeo, cableado bus dedicado, muy fiable, más caro
- **Wifi/Zigbee (Shelly, Sonoff)**: sin obra, más económico, para reformas
- **X10/Powerline**: por la propia red eléctrica, menos fiable

**Qué se automatiza normalmente:**
- Iluminación (regulación, escenas, presencia)
- Persianas/toldos
- Climatización
- Seguridad (alarmas, cámaras)
- Riego

**Precio orientativo:** instalación domótica básica (iluminación + persianas) en vivienda: desde 1.500€ hasta 5.000€+ según alcance con KNX.

Si el cliente pide domótica, recuerda incluir el circuito C11 (automatización) en electrificación elevada.`,
  },
  {
    keywords: /cargador.*coche|vehiculo.*electrico|punto.*recarga|wallbox/,
    response: `**Instalación de cargador de vehículo eléctrico (ITC-BT-52):**

**Tipos de instalación:**
- **Modo 2**: carga desde enchufe normal con cable especial (lento, no recomendado como fijo)
- **Modo 3 (wallbox)**: instalación fija con circuito dedicado - lo habitual

**Requisitos:**
- Circuito independiente desde el cuadro (nunca compartido)
- Diferencial tipo A o B según el wallbox (algunos ya lo integran)
- Protección diferencial de 30mA + magnetotérmico según potencia del cargador
- Sección de cable según potencia: 3.7kW (16A, 2.5mm²), 7.4kW (32A, 6mm²), 11kW (16A trifásico), 22kW (32A trifásico)
- Base de conexión Tipo 2 (Mennekes) es el estándar en Europa

**Trámite:** requiere boletín eléctrico específico y en algunas comunidades registro de punto de recarga.

Ya tienes en tu catálogo el Policharger NW-T2 7.4KW (comprado en Sokoel).`,
  },
  {
    keywords: /fotovoltaica|placas.*solares|autoconsumo|itc.*40/,
    response: `**Instalaciones fotovoltaicas / Autoconsumo (ITC-BT-40 y RD 244/2019):**

**Tipos de autoconsumo:**
- **Sin excedentes**: no vierte a la red (batería o limitador)
- **Con excedentes y compensación**: vende el excedente, compensa en factura
- **Con excedentes sin compensación**: vende a mercado

**Elementos de la instalación:**
- Paneles solares + estructura de sujeción
- Inversor (convierte DC a AC)
- Protecciones DC (fusibles, seccionador) y AC (magnetotérmico, diferencial)
- Contador bidireccional (lo pone la distribuidora)
- Opcional: batería de almacenamiento

**Trámites:**
- Instalaciones <15kW: trámite simplificado (RITSIC en Euskadi)
- CAU (Código Autoconsumo) que gestiona la distribuidora
- Legalización en industria + boletín específico

Es un mercado en crecimiento - considera especializarte con un curso específico si te interesa este nicho.`,
  },

  // ============ AVERIAS Y DIAGNOSTICO ============
  {
    keywords: /salta.*diferencial|dispara.*diferencial|se.*va.*la.*luz/,
    response: `**Diagnóstico: salta el diferencial**

**Pasos para localizar la avería:**
1. Desconecta todos los magnetotérmicos (circuitos)
2. Sube el diferencial - si sube y aguanta, el problema está en un circuito
3. Ve subiendo los magnetotérmicos uno a uno
4. Cuando vuelva a saltar el diferencial al subir un circuito, ese es el problema

**Causas comunes:**
- Fuga a tierra en un electrodoméstico (termo, lavadora con resistencia dañada)
- Humedad en una caja de conexión o mecanismo
- Cable pelado tocando una superficie metálica
- Diferencial defectuoso (raro, pero pasa con el tiempo)

**Si salta con TODOS los circuitos desconectados:** el diferencial está averiado o hay fuga en la propia derivación individual.`,
  },
  {
    keywords: /no.*hay.*luz|sin.*corriente|se.*ha.*ido.*la.*luz/,
    response: `**Diagnóstico: no hay corriente en toda la vivienda**

1. Comprueba el ICP (contador) - si está bajado, puede ser sobrecarga (potencia contratada superada)
2. Comprueba el IGA del cuadro propio
3. Si hay corriente en el contador pero no en el cuadro: revisar derivación individual
4. Llama a la distribuidora (Iberdrola en Bizkaia) para comprobar si hay corte de suministro en la zona
5. Si es un piso: comprobar si es corte general del edificio (hablar con el administrador/vecinos)`,
  },
  {
    keywords: /parpadea.*luz|fluctua.*tension|luces.*parpadean/,
    response: `**Diagnóstico: parpadeo de luces**

**Causas posibles:**
- Mala conexión en el punto de luz o interruptor (aflojado con el tiempo)
- Sobrecarga de circuito (muchos consumos en la misma línea)
- Regulador/dimmer incompatible con bombillas LED
- Fluctuación de la red eléctrica externa (contactar distribuidora)
- Neutro suelto en el cuadro (¡peligroso, revisar urgente!)

Si parpadean TODAS las luces de la casa a la vez y de forma sincronizada, sospecha de mal contacto en el neutro del cuadro general - revisar con urgencia.`,
  },

  // ============ EFICIENCIA Y AHORRO ============
  {
    keywords: /ahorro.*energetico|eficiencia.*energetica|bajar.*factura/,
    response: `**Consejos de eficiencia energética para recomendar a clientes:**

- Cambiar a iluminación LED (ahorro 80% vs incandescente)
- Detectores de presencia en zonas de paso
- Regulación de intensidad (dimmers) en salón/dormitorios
- Termostatos programables para calefacción eléctrica
- Revisar potencia contratada (muchas veces está sobredimensionada)
- Instalación de enchufes con temporizador para standby
- Considerar autoconsumo fotovoltaico si el tejado lo permite

Puedes ofrecer esto como servicio adicional en presupuestos de reforma integral.`,
  },

  // ============ GESTION DE LA APP / NEGOCIO DIARIO ============
  {
    keywords: /como.*uso.*esta.*app|que.*hace.*esta.*app|ayuda.*app/,
    response: `**Guía rápida de esta aplicación:**

- **Dashboard**: resumen de tu negocio, alertas, facturación mensual
- **Clientes**: gestión de contactos, WhatsApp directo, historial
- **Presupuestos**: por estancias, generación automática, duplicar, convertir a factura
- **Facturas**: TicketBAI/Batuz, descuentos, formas de pago
- **Gastos**: registra compras de Sokoel y otros proveedores para calcular tu beneficio real
- **Catálogo**: precios de compra/venta y márgenes de cada material
- **Calculadora**: mete el coste y te dice cuánto cobrar
- **Agenda**: visitas con calendario semanal y Google Maps
- **Comunicaciones**: plantillas de WhatsApp y email
- **Exportar**: saca tus datos a CSV/Excel

Pregúntame cualquier duda concreta sobre cómo hacer algo en la app.`,
  },
];

  // ============ MATERIALES Y PROVEEDORES ============
  {
    keywords: /sokoel|proveedor|donde.*comprar|distribuidor.*material/,
    response: `**Proveedores de material eléctrico en Bizkaia:**

**SOKOEL** (tu proveedor habitual):
- C/ Kareaga 37, Barakaldo | Tel: 94 472 34 30
- Más de 30 años, 3.500m² de almacén
- Marcas: Schneider, Hager, Simon, Legrand, Niessen (Tegui), Fermax, Televes...
- Tienen ecommerce propio para consultar precios, pedidos, facturas y albaranes

**Otros distribuidores en la zona:**
- Rexel, Sonepar, Anjoin - grandes distribuidores nacionales con delegación en Bizkaia
- Comparar precios en material caro (cargadores, cuadros grandes) puede ahorrarte margen

**Tip:** cuando te den una tarifa o catálogo de precios en PDF/Excel, pásamelo y lo cargo directamente en tu catálogo con precio de compra y venta calculada.`,
  },
  {
    keywords: /marca.*mecanismo|niessen|simon|bticino|legrand|schneider|hager/,
    response: `**Marcas de mecanismos y aparamenta más comunes:**

- **Niessen (Tegui/ABB)**: gama Zenit (la que usas), Sky, Arco - buena relación calidad/precio
- **Simon**: gama 27, 75, 270 - muy extendida en España
- **BTicino**: Living, Axolute - gama media-alta, diseño
- **Legrand**: Valena, Céliane - gama amplia, buena disponibilidad
- **Schneider Electric**: Odace, Unica - protecciones (Acti9) muy fiables
- **Hager**: protecciones (magnetotérmicos, diferenciales) de referencia en el sector

Para protecciones (magnetotérmicos/diferenciales) Schneider y Hager son las marcas más solicitadas por fiabilidad. Para mecanismos, Niessen Zenit es una buena opción calidad-precio como ya usas.`,
  },
  {
    keywords: /tipos.*cable|h07v|riesgo.*incendio|libre.*halogenos/,
    response: `**Tipos de cable eléctrico más usados:**

- **H07V-K**: cable flexible para instalación interior bajo tubo (el más común en vivienda)
- **RZ1-K (AS)**: libre de halógenos, para derivación individual y zonas comunes (obligatorio en edificios)
- **RV-K**: cable con aislamiento de PVC, para exterior/enterrado
- **Z1C4Z1-K**: cable apantallado para señal/datos, protegido contra interferencias

**Código de colores (según REBT):**
- Fase: marrón, negro o gris
- Neutro: azul claro
- Tierra: amarillo-verde (siempre)

En edificios de pública concurrencia o con normativa contra incendios, es obligatorio cable libre de halógenos (no emite gases tóxicos al arder).`,
  },

  // ============ MANTENIMIENTO Y CONTRATOS ============
  {
    keywords: /mantenimiento|contrato.*mantenimiento|revision.*periodica.*cliente/,
    response: `**Contratos de mantenimiento para clientes (ingreso recurrente):**

Ofrecer mantenimiento periódico a comunidades, locales o empresas te da ingresos estables.

**Qué incluir:**
- Revisión visual de cuadros y protecciones (1-2 veces/año)
- Medición de la resistencia de tierra
- Comprobación de diferenciales (botón de test)
- Revisión de alumbrado de emergencia (si aplica)
- Informe por escrito de cada visita

**Precio orientativo:**
- Comunidad pequeña: 150-300€/año
- Local comercial: 200-500€/año
- Nave industrial: 500-1500€/año según tamaño

Puedes usar la **Agenda** de esta app para programar las visitas periódicas y no olvidarte de ningún cliente.`,
  },
  {
    keywords: /vida.*util|cuando.*cambiar.*cuadro|cuadro.*antiguo/,
    response: `**Cuándo recomendar cambiar una instalación antigua:**

- Cuadro con fusibles (tapones) en vez de magnetotérmicos: recomendar actualización urgente
- Instalación sin diferencial: riesgo eléctrico grave, prioridad alta
- Cableado antiguo sin conductor de tierra: en edificios anteriores a los 70-80
- Más de 25-30 años sin revisión: proponer inspección completa
- Ampliaciones "caseras" sin protección adecuada: detectar y corregir

Esto es una buena oportunidad de venta: ofrece un presupuesto de "modernización de instalación" cuando veas cuadros antiguos en clientes.`,
  },

  // ============ ATENCION AL CLIENTE ============
  {
    keywords: /como.*hablar.*cliente|explicar.*presupuesto.*cliente|cliente.*duda/,
    response: `**Consejos para presentar presupuestos a clientes:**

- Desglosa por estancias (como ya hace esta app) - se entiende mejor que una lista larga
- Explica brevemente el "por qué" de cada partida importante (ej: "el diferencial es obligatorio por normativa")
- Da la validez del presupuesto por escrito (15 días es lo habitual)
- Si el presupuesto es alto, ofrece la opción de fraccionar el pago o hacerlo por fases
- Envía el presupuesto por WhatsApp o email con la app (botón "Enviar por email")
- Si aceptan, pide señal antes de empezar en trabajos grandes (>1000€)

La transparencia y explicar el porqué de la normativa genera confianza y reduce el "regateo".`,
  },
  {
    keywords: /garantia.*trabajo|cuanto.*dura.*garantia/,
    response: `**Garantías en instalaciones eléctricas:**

- **Garantía legal según Código Civil**: por vicios ocultos, hasta varios años según se trate de mano de obra o material
- **Garantía de fabricante en materiales**: normalmente 2 años (Niessen, Schneider, etc.)
- **Recomendación práctica**: ofrece garantía de 1-2 años en mano de obra por escrito en la factura/presupuesto

Indícalo en las notas de la factura, genera confianza: "Garantía de instalación: 2 años en mano de obra."`,
  },

  // ============ VEHICULO Y DESPLAZAMIENTOS ============
  {
    keywords: /kilometraje|dietas.*deducibles|gastos.*vehiculo.*deducir/,
    response: `**Gastos de vehículo y dietas deducibles:**

**Deducible si el vehículo es de uso exclusivo profesional:**
- Combustible, seguro, ITV, reparaciones, amortización
- Peajes y parking en desplazamientos de trabajo

**Dietas (manutención) deducibles con límites (Hacienda):**
- Sin pernocta: hasta ~26.67€/día en España (revisar límite vigente)
- Con pernocta: hasta ~53.34€/día

**Importante:** guarda siempre el ticket/factura y anótalo en la sección **Gastos** de la app con la categoría correcta (Gasolina, Peajes, Dietas...) para tener todo documentado ante una inspección.

Si usas el vehículo también para uso personal, Hacienda solo permite deducir el % de uso profesional salvo que puedas demostrar uso exclusivo.`,
  },

  // ============ CALIDAD Y NORMATIVA ADICIONAL ============
  {
    keywords: /grado.*proteccion|ip.*44|ip.*65|estanqueidad/,
    response: `**Grados de protección IP (estanqueidad):**

Formato IP + 2 cifras: primera = sólidos, segunda = líquidos

| IP | Significado |
|----|-------------|
| IP20 | Protección básica interior, sin agua ni polvo |
| IP44 | Protegido contra salpicaduras y objetos >1mm (baños zona 3, exterior cubierto) |
| IP55 | Protegido contra chorros de agua (exterior, industria) |
| IP65 | Estanco al polvo y chorros de agua (exterior, luminarias) |
| IP67 | Sumergible temporalmente (volumen 0 piscinas/baños) |
| IP68 | Sumergible permanente |

Regla práctica: exterior sin cubrir → mínimo IP65. Baños según volumen → IP24 a IP67 (ver ITC-BT-27).`,
  },
  {
    keywords: /clase.*aislamiento|clase.*i|clase.*ii|clase.*iii/,
    response: `**Clases de aislamiento eléctrico:**

- **Clase 0**: sin toma de tierra, sin doble aislamiento (prohibido en instalaciones nuevas)
- **Clase I**: con toma de tierra obligatoria (electrodomésticos metálicos: lavadora, horno)
- **Clase II**: doble aislamiento, no necesita tierra (simbolo cuadrado doble) - taladros, algunas luminarias
- **Clase III**: muy baja tensión de seguridad (12V, 24V) - juguetes, luminarias de piscina

Es importante identificar la clase del aparato para saber si necesita conductor de protección (tierra) en su circuito.`,
  },

  // ============ IVA Y FACTURACION ============
  {
    keywords: /iva.*reducido|iva.*10.*vivienda|iva.*rehabilitacion/,
    response: `**IVA reducido en reformas de vivienda (10%):**

Se aplica el **10% de IVA** (en vez del 21%) cuando se cumplen TODOS estos requisitos:
- El destinatario es persona física (particular) y usa la vivienda para uso propio
- La construcción de la vivienda finalizó hace más de 2 años
- Las obras son de renovación o reparación (no obra nueva)
- El coste de materiales aportados no supera el 40% del total de la operación

**Importante:** si el material que tú pones supera el 40% del total, se aplica el 21% general a toda la factura, no solo a la parte de material.

Indícalo bien en tus facturas cuando aplique, y consulta con tu gestor casos límite.`,
  },
  {
    keywords: /factura.*rectificativa|abono|anular.*factura/,
    response: `**Cómo corregir una factura ya emitida:**

No se puede simplemente "borrar" una factura enviada a Batuz. El procedimiento correcto es:

1. **Factura rectificativa**: nueva factura que anula/corrige la anterior, referenciando su número
2. Debe enviarse también a TicketBAI/Batuz como rectificativa
3. Motivo habitual: error en importe, datos del cliente, o devolución

En esta app, si necesitas corregir una factura ya enviada a Batuz, lo correcto es crear una nueva factura de signo contrario o rectificativa y gestionarla igual que una factura normal, indicando en las notas que rectifica a la factura Nº X.`,
  },
];

export const EXTRA_SUGGESTION_CHIPS = [
  "Que herramientas necesito",
  "Locales humedos ITC-BT-27",
  "Cargador coche electrico",
  "Fotovoltaica autoconsumo",
  "Salta el diferencial",
  "Como calcular mis precios",
  "IRPF y gastos deducibles",
  "Boletin electrico",
  "EPIs y seguridad",
  "Domotica KNX",
  "Contrato de mantenimiento",
  "IVA reducido reforma vivienda",
  "Grados de proteccion IP",
  "Marcas de mecanismos",
  "Clientes morosos",
];
