export interface MessageTemplate {
  id: string;
  name: string;
  type: "whatsapp" | "email" | "sms";
  subject?: string;
  body: string;
}

export const templates: MessageTemplate[] = [
  {
    id: "presupuesto_enviado",
    name: "Presupuesto enviado",
    type: "whatsapp",
    body: "Hola {nombre}, le envio el presupuesto solicitado por un importe de {total}EUR (IVA incluido). Quedo a su disposicion para cualquier consulta. Un saludo, Ivan Oyarzabal.",
  },
  {
    id: "factura_enviada",
    name: "Factura enviada",
    type: "email",
    subject: "Factura {numero} - Ivan Martin Oyarzabal",
    body: "Estimado/a {nombre},\n\nAdjunto le remito la factura {numero} por importe de {total}EUR.\n\nDatos de pago:\nBBVA: ES66 0182 0450 1102 0150 3156\n\nQuedo a su disposicion.\n\nUn saludo,\nIvan Martin Oyarzabal\nTfno: 688 867 530",
  },
  {
    id: "recordatorio_pago",
    name: "Recordatorio de pago",
    type: "whatsapp",
    body: "Hola {nombre}, le recuerdo que tiene pendiente el pago de la factura {numero} por importe de {total}EUR. Puede realizar la transferencia a BBVA ES66 0182 0450 1102 0150 3156. Gracias, Ivan.",
  },
  {
    id: "confirmar_visita",
    name: "Confirmar visita",
    type: "sms",
    body: "Hola {nombre}, le confirmo la visita para el {fecha} a las {hora}. Direccion: {direccion}. Si necesita cambiarla, contacteme. Ivan Oyarzabal.",
  },
  {
    id: "trabajo_finalizado",
    name: "Trabajo finalizado",
    type: "whatsapp",
    body: "Hola {nombre}, le informo que el trabajo ha sido finalizado correctamente. Proximamente le enviare la factura correspondiente. Gracias por su confianza. Un saludo, Ivan.",
  },
  {
    id: "seguimiento",
    name: "Seguimiento post-trabajo",
    type: "whatsapp",
    body: "Hola {nombre}, espero que todo funcione correctamente tras la instalacion realizada. Si tiene cualquier duda o incidencia, no dude en contactarme. Un saludo, Ivan Oyarzabal.",
  },
];

export function fillTemplate(
  template: MessageTemplate,
  variables: Record<string, string>
): { subject?: string; body: string } {
  let body = template.body;
  let subject = template.subject;

  for (const [key, value] of Object.entries(variables)) {
    body = body.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    if (subject) {
      subject = subject.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
  }

  return { subject, body };
}
