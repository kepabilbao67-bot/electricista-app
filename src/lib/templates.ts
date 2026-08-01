export interface MessageTemplate {
  id: string;
  name: string;
  type: "whatsapp" | "email" | "sms";
  subject?: string;
  body: string;
}

export const templates: MessageTemplate[] = [
  {
    id: "confirmar_visita",
    name: "Confirmación de visita",
    type: "whatsapp",
    body: "Hola {nombre}, confirmamos la visita prevista para el {fecha} a las {hora}. Dirección: {direccion}. Si necesitas cambiarla, responde a este mensaje. Gracias.",
  },
  {
    id: "recordatorio_visita",
    name: "Recordatorio de visita",
    type: "whatsapp",
    body: "Hola {nombre}, te recordamos la visita prevista para el {fecha} a las {hora}. Si necesitas cambiarla, indícanoslo. Gracias.",
  },
  {
    id: "presupuesto_enviado",
    name: "Presupuesto preparado",
    type: "whatsapp",
    body: "Hola {nombre}, hemos preparado el presupuesto {numero} por un total de {total} EUR. Puedes revisarlo antes de confirmar si estás conforme o necesitas algún ajuste.",
  },
  {
    id: "solicitar_aceptacion",
    name: "Solicitud de aceptación",
    type: "whatsapp",
    body: "Hola {nombre}, ¿has podido revisar el presupuesto {numero}? Cuando estés conforme, responde indicando que lo aceptas para que podamos organizar el trabajo. Gracias.",
  },
  {
    id: "parte_preparado",
    name: "Parte de trabajo preparado",
    type: "whatsapp",
    body: "Hola {nombre}, el parte de trabajo {numero} está preparado para tu revisión. Si detectas algún dato que deba corregirse, indícanoslo antes de confirmarlo.",
  },
  {
    id: "factura_preparada",
    name: "Factura preparada",
    type: "whatsapp",
    body: "Hola {nombre}, la factura {numero} por {total} EUR está preparada. Puedes revisar el documento y consultarnos cualquier duda.",
  },
  {
    id: "trabajo_finalizado",
    name: "Trabajo finalizado",
    type: "whatsapp",
    body: "Hola {nombre}, el trabajo ha finalizado. Si observas cualquier incidencia o necesitas una aclaración, responde a este mensaje. Gracias por tu confianza.",
  },
  {
    id: "recordatorio_pago_amable",
    name: "Recordatorio de pago amable",
    type: "whatsapp",
    body: "Hola {nombre}, te recordamos amablemente que la factura {numero} por {total} EUR figura pendiente. Si ya has realizado el pago, disculpa la molestia. Si necesitas revisar algún dato, estamos a tu disposición.",
  },
  {
    id: "seguimiento",
    name: "Seguimiento post-trabajo",
    type: "whatsapp",
    body: "Hola {nombre}, queríamos comprobar que todo continúa funcionando correctamente después del trabajo. Si necesitas ayuda, responde a este mensaje.",
  },
  {
    id: "solicitar_resena",
    name: "Solicitud de reseña",
    type: "whatsapp",
    body: "Hola {nombre}, gracias por confiar en nuestro trabajo. Si tu experiencia ha sido positiva, agradeceríamos que compartieras una reseña. Muchas gracias.",
  },
];

export function fillTemplate(
  template: MessageTemplate,
  values: Record<string, string | number | null | undefined>
): { subject?: string; body: string } {
  const replace = (text: string) => text.replace(/\{([a-z_]+)\}/gi, (match, key: string) => {
    const value = values[key];
    return value === null || value === undefined || value === "" ? match : String(value);
  });
  return {
    subject: template.subject ? replace(template.subject) : undefined,
    body: replace(template.body),
  };
}
