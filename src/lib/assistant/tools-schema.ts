/**
 * AUTÓNOMO360 - Tools & Function Calling Schemas (OpenAI API)
 *
 * Define las herramientas de lectura de datos del negocio y generación de borradores.
 */

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export const ASSISTANT_TOOLS: OpenAITool[] = [
  {
    type: "function",
    function: {
      name: "query_clients",
      description: "Busca clientes por nombre o empresa (excluye teléfono, email o datos personales).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Nombre o empresa a buscar (máx 100 caracteres)",
          },
          status: {
            type: "string",
            description: "Filtrar por estado del cliente (ej: activo, lead, doc_pendiente, inactivo)",
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (entre 1 y 10)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_budgets",
      description: "Consulta presupuestos emitidos filtrando por estado o nombre de cliente.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Estado del presupuesto (ej: borrador, enviado, aceptado, rechazado, facturado)",
          },
          client_name: {
            type: "string",
            description: "Nombre del cliente",
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (entre 1 y 10)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_invoices",
      description: "Consulta facturas cobradas o pendientes filtrando por estado o cliente.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Estado de la factura (ej: borrador, pendiente, cobrada, rectificativa)",
          },
          client_name: {
            type: "string",
            description: "Nombre del cliente",
          },
          overdue_only: {
            type: "boolean",
            description: "Si es true, sólo devuelve facturas pendientes o vencidas",
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (entre 1 y 10)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_partes",
      description: "Consulta partes de trabajo u órdenes de servicio.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Estado del parte (ej: borrador, pendiente, en_progreso, completado, firmado)",
          },
          client_name: {
            type: "string",
            description: "Nombre del cliente",
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (entre 1 y 10)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_schedule",
      description: "Consulta la agenda de citas y reuniones sin incluir direcciones privadas ni teléfonos.",
      parameters: {
        type: "object",
        properties: {
          start_date: {
            type: "string",
            description: "Fecha de inicio (YYYY-MM-DD)",
          },
          days_ahead: {
            type: "number",
            description: "Días a consultar (máx 14)",
          },
          client_name: {
            type: "string",
            description: "Nombre del cliente",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_budget",
      description: "Genera una tarjeta de BORRADOR de presupuesto para confirmación del autónomo.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Nombre del cliente" },
          title: { type: "string", description: "Título del presupuesto" },
          notes: { type: "string", description: "Notas aclaratorias" },
          items: {
            type: "array",
            description: "Líneas del presupuesto",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "number" },
              },
              required: ["description", "quantity", "unit_price"],
            },
          },
        },
        required: ["client_name", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_visit",
      description: "Genera una tarjeta de BORRADOR de cita para agendar previa confirmación.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Nombre del cliente" },
          title: { type: "string", description: "Título de la cita" },
          date: { type: "string", description: "Fecha YYYY-MM-DD" },
          time: { type: "string", description: "Hora de inicio" },
        },
        required: ["client_name", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_client",
      description: "Genera una tarjeta de BORRADOR de alta de cliente.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre completo del cliente" },
          company: { type: "string", description: "Nombre de empresa" },
        },
        required: ["name"],
      },
    },
  },
];
