import type { ScoredLead, CommercialMessages } from './types';

export class MessagingService {
  generateDrafts(lead: ScoredLead): CommercialMessages {
    const company = lead.company;
    const companyName = company.name;
    const location = company.address.value || 'vuestra zona';

    // Prudent phrasing without unproven quantitative claims
    const linkedInText = `Hola, he visto vuestra actividad profesional en el sector de instalaciones en ${location}. Desarrollamos una herramienta diseñada para facilitar la elaboración de partes de trabajo, presupuestos y facturación en movilidad desde el móvil o tablet. Si os resulta de interés explorar cómo podría simplificar la operativa administrativa del día a día, estaré encantado de compartir una breve demo sin compromiso. Un saludo.`;

    const emailSubject = `Gestión técnica y administrativa para ${companyName}`;
    const emailBody = `Hola,\n\nOs contacto con motivo de vuestra actividad en ${companyName}.\n\nHemos desarrollado una solución concebida para profesionales del sector de instalaciones, pensada para agilizar la creación de partes de trabajo en obra, presupuestos y control de facturación desde el teléfono móvil o tablet.\n\nEl objetivo de la plataforma es facilitar los trámites administrativos diarios y la gestión documental directamente en las visitas técnicas.\n\nSi consideráis que puede ser útil para vuestra operativa habitual, podemos coordinar una breve demostración cuando os venga bien.\n\nAtentamente,\nEquipo KepaForce 360`;

    const whatsappText = `Hola, os contacto por vuestro trabajo en ${companyName}. Hemos preparado una aplicación orientada a instaladores para generar partes de trabajo y presupuestos en el móvil durante las visitas. ¿Os interesaría ver un vídeo de 2 minutos para valorar si os resulta útil?`;

    const smsText = `Hola ${companyName}, disponemos de una app para instaladores pensada para crear partes y presupuestos desde el móvil. Más info disponible.`;

    return {
      linkedIn: {
        title: `Propuesta de contacto para ${companyName}`,
        text: linkedInText,
        notice: 'CANAL MANUAL ÚNICAMENTE: Copiar y pegar de forma individual en LinkedIn. Cero automatización o bots.',
      },
      email: {
        subject: emailSubject,
        text: emailBody,
      },
      whatsapp: {
        text: whatsappText,
      },
      sms: {
        text: smsText,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
