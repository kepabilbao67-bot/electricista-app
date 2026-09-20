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
      description: "Busca clientes por nombre o empresa y devuelve candidatos sin seleccionar automáticamente coincidencias ambiguas (excluye teléfono, email y otros datos personales).",
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
      name: "query_catalog",
      description: "Busca materiales o conceptos existentes en el catálogo. Solo devuelve precios y datos almacenados; nunca inventa artículos ni importes.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto a buscar en nombre, descripción, categoría o referencia de proveedor",
          },
          name: {
            type: "string",
            description: "Texto contenido en el nombre del material o concepto",
          },
          description: {
            type: "string",
            description: "Texto contenido en la descripción",
          },
          category: {
            type: "string",
            description: "Categoría del catálogo",
          },
          supplier_reference: {
            type: "string",
            description: "Referencia del proveedor",
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
            description: "Estado real del presupuesto (ej: draft, sent, accepted, rejected)",
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
            description: "Estado real de la factura (ej: draft, sent, paid, pending_batuz)",
          },
          client_name: {
            type: "string",
            description: "Nombre del cliente",
          },
          overdue_only: {
            type: "boolean",
            description: "Si es true, solo devuelve facturas no cobradas cuya fecha de vencimiento ya ha pasado",
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
            description: "Estado real del parte (ej: borrador, pendiente, en_progreso, completado, firmado, facturado)",
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
