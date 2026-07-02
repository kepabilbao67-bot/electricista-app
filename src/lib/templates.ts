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
    id: "presupuesto_aceptado",
    name: "Presupuesto aceptado",
    type: "whatsapp",
    body: "Hola {nombre}, le confirmo que hemos recibido la aceptacion de su presupuesto. Procedemos a organizar la ejecucion del trabajo. Le contactare para fijar fecha y hora. Un saludo, Ivan Oyarzabal.",
  },
  {
    id: "factura_enviada",
    name: "Factura enviada",
    type: "email",
    subject: "Factura {numero} - Ivan Martin Oyarzabal",
    body: "Estimado/a {nombre},\n\nAdjunto le remito la factura {numero} por importe de {total}EUR.\n\nDatos de pago:\nBBVA: ES66 0182 0450 1102 0150 3156\n\nQuedo a su disposicion.\n\nUn saludo,\nIvan Martin Oyarzabal\nTfno: 688 867 530",
  },
  {
    id: "factura_adjunta",
    name: "Factura adjunta",
    type: "email",
    subject: "Factura adjunta - Ivan Martin Oyarzabal Electricista",
    body: "Estimado/a {nombre},\n\nLe adjunto la factura correspondiente al trabajo realizado.\n\nForma de pago: Transferencia bancaria\nBBVA: ES66 0182 0450 1102 0150 3156\nTitular: MARTIN OYARZABAL IVAN\n\nSi tiene alguna duda no dude en contactarme.\n\nUn saludo,\nIvan Martin Oyarzabal\nTfno: 688 867 530",
  },
  {
    id: "recordatorio_pago",
    name: "Recordatorio de pago",
    type: "whatsapp",
    body: "Hola {nombre}, le recuerdo que tiene pendiente el pago de la factura {numero} por importe de {total}EUR. Puede realizar la transferencia a BBVA ES66 0182 0450 1102 0150 3156. Gracias, Ivan.",
  },
  {
    id: "recordatorio_pago_amable",
    name: "Recordatorio de pago (amable)",
    type: "whatsapp",
    body: "Hola {nombre}, espero que este bien. Le escribo para recordarle amablemente que la factura {numero} por {total}EUR esta pendiente de pago. Si ya ha realizado la transferencia, disculpe la molestia. Datos bancarios: BBVA ES66 0182 0450 1102 0150 3156. Gracias, Ivan Oyarzabal.",
  },
  {
    id: "confirmar_visita",
    name: "Confirmar visita",
    type: "whatsapp",
    body: "Hola {nombre}, le confirmo la visita para el {fecha} a las {hora}. Direccion: {direccion}. Si necesita cambiarla, contacteme al 688 867 530. Ivan Oyarzabal.",
  },
  {
    id: "trabajo_finalizado",
    name: "Trabajo finalizado",
    type: "whatsapp",
    body: "Hola {nombre}, le informo que el trabajo ha sido finalizado correctamente. Todo queda funcionando en perfecto estado. Proximamente le enviare la factura correspondiente. Gracias por su confianza. Un saludo, Ivan Oyarzabal. Tel: 688 867 530.",
  },
  {
    id: "seguimiento",
    name: "Seguimiento post-trabajo",
    type: "whatsapp",
    body: "Hola {nombre}, espero que todo funcione correctamente tras la instalacion realizada. Si tiene cualquier duda o incidencia, no dude en contactarme. Un saludo, Ivan Oyarzabal.",
  },
  {
    id: "solicitar_resena",
    name: "Solicitar resena",
    type: "whatsapp",
    body: "Hola {nombre}, espero que este satisfecho/a con el trabajo realizado. Si es asi, le agradeceria mucho una resena en Google. Esto me ayuda a seguir ofreciendo un buen servicio. Muchas gracias, Ivan Oyarzabal.",
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
