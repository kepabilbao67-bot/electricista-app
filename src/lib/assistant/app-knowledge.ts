/**
 * Mapa de módulos de Autonomo360.
 * Fuente única de verdad sobre qué puede hacer la app.
 * Actualizar con cada PR que modifique funcionalidad.
 */

export type ModuleStatus = "REAL" | "DEMO" | "PARCIAL" | "NO_DISPONIBLE";

export interface AppModule {
  name: string;
  route: string;
  status: ModuleStatus;
  description: string;
  features: string[];
  limitations: string[];
  usage: string;
  warnings?: string[];
}

export const APP_MODULES: AppModule[] = [
  {
    name: "Dashboard",
    route: "/",
    status: "REAL",
    description: "Panel de control con KPIs, gráfico de facturación mensual, alertas y acciones rápidas.",
    features: [
      "6 KPIs: facturación total, pendiente de cobro, facturas este mes, presupuestos pendientes, próximas tareas, clientes activos",
      "Gráfico de barras de facturación de los últimos 6 meses",
      "Alertas: facturas vencidas >30 días, presupuestos por caducar, visitas de hoy",
      "Top 3 clientes por facturación",
      "Comparativa mes actual vs anterior",
      "Acciones rápidas: nueva factura, presupuesto, tarea, cliente, mensaje",
      "Últimas 5 facturas y próximas tareas",
    ],
    limitations: ["Si la base de datos está vacía, muestra ceros"],
    usage: "Accede a / o haz clic en Dashboard en el menú lateral.",
  },
  {
    name: "Clientes",
    route: "/clientes",
    status: "REAL",
    description: "Gestión completa de clientes con CRUD, comunicación directa y tipos.",
    features: [
      "Crear, editar y eliminar clientes",
      "Tipos: particular y empresa",
      "Campos: nombre, NIF, email, teléfono, dirección, ciudad, código postal, provincia, notas",
      "Búsqueda por nombre",
      "Botón WhatsApp, teléfono y email directo",
      "Importación CSV o pegado de datos",
      "Vista detalle con historial de facturas, comunicaciones y visitas",
    ],
    limitations: [],
    usage: "Ve a /clientes. Haz clic en 'Nuevo cliente' para crear uno. Haz clic en un nombre para ver su ficha.",
  },
  {
    name: "Leads",
    route: "/leads",
    status: "REAL",
    description: "Pipeline de captación de clientes potenciales con estados de avance.",
    features: [
      "Crear leads con nombre, email, teléfono, origen, interés y mensaje",
      "Estados: nuevo, contactado, cualificado, convertido, descartado",
      "Cambio de estado inline desde la tabla",
      "Persistencia en base de datos",
    ],
    limitations: ["No convierte automáticamente un lead en un registro de cliente al marcarlo como convertido"],
    usage: "Ve a /leads. Haz clic en 'Nuevo lead' para registrar un contacto comercial. Cambia su estado desde el desplegable.",
  },
  {
    name: "Presupuestos",
    route: "/presupuestos",
    status: "REAL",
    description: "Creación y gestión de presupuestos con generador automático por zonas/estancias.",
    features: [
      "Generador automático por tipo de vivienda (piso, chalet, local) con habitaciones y baños",
      "Zonas predefinidas con circuitos REBT",
      "Integración con catálogo de materiales",
      "Estados: borrador, enviado, aceptado, rechazado",
      "Conversión a factura",
      "Duplicar presupuesto",
      "Fecha de validez con detección de caducidad",
      "Vista imprimible/PDF",
    ],
    limitations: [],
    usage: "Ve a /presupuestos. Haz clic en 'Nuevo presupuesto'. Usa el generador automático para calcular por estancias o añade líneas manuales.",
  },
  {
    name: "Facturas",
    route: "/facturas",
    status: "REAL",
    description: "Facturación completa con descuentos, estados y TicketBAI (País Vasco).",
    features: [
      "Crear facturas con líneas, descuentos por línea (% o EUR) y métodos de pago",
      "Estados: borrador, enviada, cobrada, vencida",
      "Marcar como cobrada",
      "Duplicar factura",
      "Eliminar borradores",
      "Numeración automática (DFB_XXXX)",
      "Integración con catálogo de materiales",
      "TicketBAI/Batuz (solo País Vasco)",
    ],
    limitations: ["TicketBAI aplica únicamente en Euskadi"],
    usage: "Ve a /facturas. Haz clic en 'Nueva factura'. Selecciona cliente, añade líneas y guarda.",
    warnings: ["TicketBAI solo aplica a autónomos dados de alta en Bizkaia, Gipuzkoa o Araba. No es obligatorio en el resto de España."],
  },
  {
    name: "Partes de trabajo",
    route: "/partes-trabajo",
    status: "DEMO",
    description: "Registro de intervenciones eléctricas con vista imprimible profesional.",
    features: [
      "Lista de partes con búsqueda y estados (borrador, firmado, cerrado)",
      "Formulario: datos generales, cliente, trabajos realizados, materiales, observaciones",
      "Vista imprimible con cabecera, tablas, firmas y texto legal",
      "Botón Imprimir / Guardar PDF",
    ],
    limitations: [
      "Los datos NO se guardan en base de datos",
      "Al recargar la página se pierden los partes nuevos",
      "Solo funcionan los partes de demostración precargados",
    ],
    usage: "Ve a /partes-trabajo. Puedes ver los partes de demostración haciendo clic en 'Ver'. El formulario de nuevo parte valida pero no persiste.",
    warnings: ["Módulo en fase demo. La persistencia se añadirá en una próxima versión."],
  },
  {
    name: "Gastos",
    route: "/gastos",
    status: "REAL",
    description: "Registro de compras y gastos del negocio con categorías específicas de electricista.",
    features: [
      "12 categorías rápidas: material, gasolina, dietas, peajes, herramientas, etc.",
      "Líneas de detalle con descuentos",
      "NIF del proveedor",
      "Asignación a obra/proyecto",
      "KPI de totales",
    ],
    limitations: [],
    usage: "Ve a /gastos. Haz clic en 'Nuevo gasto'. Selecciona categoría, añade líneas y guarda.",
  },
  {
    name: "Agenda",
    route: "/agenda",
    status: "REAL",
    description: "Calendario de visitas y tareas con vista semanal y lista.",
    features: [
      "Vista semanal tipo calendario con horas",
      "Vista lista alternativa",
      "Estados: programada, completada, cancelada",
      "Integración Google Maps para direcciones",
      "Navegación entre semanas",
      "Crear, editar y eliminar visitas",
    ],
    limitations: [],
    usage: "Ve a /agenda. Alterna entre vista calendario y lista. Haz clic en 'Nueva visita' para programar una tarea.",
  },
  {
    name: "Catálogo",
    route: "/catalogo",
    status: "REAL",
    description: "Materiales y servicios con precios de coste/venta y calculadora de márgenes.",
    features: [
      "CRUD de materiales con nombre, precio de venta, categoría",
      "Precio de coste (compra) y cálculo automático de margen",
      "Búsqueda y filtro por categoría",
      "Calculadora de márgenes (ruta /catalogo/calculadora)",
      "Alimenta presupuestos y facturas automáticamente",
    ],
    limitations: [],
    usage: "Ve a /catalogo para gestionar materiales. Usa la Calculadora (botón superior) para calcular precios de venta con margen.",
  },
  {
    name: "Comunicaciones",
    route: "/comunicaciones",
    status: "PARCIAL",
    description: "Plantillas de mensajes y generación de comunicaciones por WhatsApp, email y SMS.",
    features: [
      "Plantillas predefinidas para recordatorios, presupuestos, etc.",
      "Generación de enlace WhatsApp directo",
      "Copia de texto al portapapeles",
      "Historial de comunicaciones por cliente",
      "Filtro por tipo de canal",
    ],
    limitations: [
      "No envía emails realmente desde la app",
      "No envía SMS",
      "WhatsApp abre la app externa del usuario con el texto preparado",
    ],
    usage: "Ve a /comunicaciones. Selecciona un cliente y una plantilla. Haz clic en 'Enviar por WhatsApp' para abrir la conversación preparada.",
    warnings: ["La app prepara los mensajes pero no los envía directamente. Debes confirmar el envío en WhatsApp/email."],
  },
  {
    name: "Asistente / Normativa",
    route: "/normativa",
    status: "REAL",
    description: "Chat con asistente de IA para normativa eléctrica, negocio, precios y seguridad.",
    features: [
      "Motor online (OpenAI) cuando hay clave configurada",
      "Motor offline con base de conocimiento REBT, fiscalidad, averías, herramientas, etc.",
      "Integración con catálogo del usuario para consultas de precios",
      "Sugerencias rápidas de temas",
      "Historial de conversación en sesión",
    ],
    limitations: [
      "Sin clave de IA, solo responde el motor offline (respuestas predefinidas por tema)",
      "No puede realizar acciones en la app, solo informar",
    ],
    usage: "Ve a /normativa. Escribe tu pregunta o usa las sugerencias rápidas. El asistente responde con información de normativa, precios del catálogo y consejos de negocio.",
  },
  {
    name: "Exportar",
    route: "/exportar",
    status: "REAL",
    description: "Descarga de datos en CSV y backup JSON completo.",
    features: [
      "Exportar clientes en CSV",
      "Exportar facturas en CSV",
      "Exportar presupuestos en CSV",
      "Backup completo en JSON",
      "Instrucciones para importar en Excel, Google Sheets y Airtable",
    ],
    limitations: ["No genera PDFs individuales desde esta pantalla"],
    usage: "Ve a /exportar. Haz clic en el botón correspondiente para descargar el archivo.",
  },
];

/**
 * Genera texto compacto del mapa de la app para incluir en el prompt del asistente.
 */
export function buildAppKnowledgeContext(): string {
  const lines = APP_MODULES.map((m) => {
    const statusTag = `[${m.status}]`;
    const limitText = m.limitations.length > 0 ? ` Limitaciones: ${m.limitations.join("; ")}` : "";
    return `- ${m.name} (${m.route}) ${statusTag}: ${m.description}${limitText}`;
  });
  return `Módulos de la aplicación Autonomo360:\n${lines.join("\n")}`;
}

/**
 * Responde preguntas sobre la app usando el mapa de módulos.
 */
export function answerAboutApp(query: string): string | null {
  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Pregunta general sobre la app
  if (q.match(/como.*uso.*app|que.*hace.*app|ayuda.*app|modulos|funciones.*app|que.*puedo.*hacer/)) {
    const table = APP_MODULES.map((m) => `| ${m.name} | ${m.route} | ${m.status} | ${m.description.slice(0, 60)} |`).join("\n");
    return `**Módulos de Autonomo360:**\n\n| Módulo | Ruta | Estado | Descripción |\n|--------|------|--------|-------------|\n${table}\n\n**Estados:**\n- REAL: funciona y persiste datos.\n- DEMO: muestra la interfaz pero no guarda datos permanentemente.\n- PARCIAL: funciona con limitaciones (ver detalle de cada módulo).\n\nPregúntame sobre un módulo concreto para obtener instrucciones detalladas.`;
  }

  // Buscar módulo específico
  for (const mod of APP_MODULES) {
    const nameNorm = mod.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const routeKey = mod.route.replace("/", "").replace("-", " ");
    if (q.includes(nameNorm) || q.includes(routeKey)) {
      let response = `**${mod.name}** (${mod.route}) — Estado: ${mod.status}\n\n${mod.description}\n\n`;
      response += `**Cómo usarlo:**\n${mod.usage}\n\n`;
      if (mod.features.length > 0) {
        response += `**Funciones:**\n${mod.features.map((f) => `- ${f}`).join("\n")}\n\n`;
      }
      if (mod.limitations.length > 0) {
        response += `**Limitaciones:**\n${mod.limitations.map((l) => `- ${l}`).join("\n")}\n\n`;
      }
      if (mod.warnings && mod.warnings.length > 0) {
        response += `**Importante:**\n${mod.warnings.map((w) => `⚠️ ${w}`).join("\n")}\n`;
      }
      return response;
    }
  }

  return null;
}
