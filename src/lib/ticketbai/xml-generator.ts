import { create } from "xmlbuilder2";
import { TICKETBAI_CONFIG } from "./config";
import type { TicketBAIInvoice, TicketBAIResponse } from "./types";
import crypto from "crypto";

export function generateTicketBAIXml(
  invoice: TicketBAIInvoice
): TicketBAIResponse {
  const ticketbaiId = `TBAI-${TICKETBAI_CONFIG.emisor.nif}-${invoice.fecha.replace(/-/g, "")}-${invoice.serie}${invoice.numero}`;

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("T:TicketBai", {
      "xmlns:T": "urn:ticketbai:emision",
    })
    .ele("Cabecera")
      .ele("IDVersionTBAI").txt(TICKETBAI_CONFIG.version).up()
    .up()
    .ele("Sujetos")
      .ele("Emisor")
        .ele("NIF").txt(invoice.emisor.nif).up()
        .ele("ApellidosNombreRazonSocial").txt(invoice.emisor.nombre).up()
      .up();

  // Destinatario
  if (invoice.destinatario) {
    doc
      .ele("Destinatarios")
        .ele("IDDestinatario")
          .ele("NIF").txt(invoice.destinatario.nif).up()
          .ele("ApellidosNombreRazonSocial").txt(invoice.destinatario.nombre).up()
        .up()
      .up();
  }

  doc.up(); // Close Sujetos

  // Factura
  const facturaNode = doc
    .ele("Factura")
      .ele("CabeceraFactura")
        .ele("SerieFactura").txt(invoice.serie).up()
        .ele("NumFactura").txt(invoice.numero).up()
        .ele("FechaExpedicionFactura").txt(invoice.fecha).up()
        .ele("HoraExpedicionFactura").txt(invoice.hora).up()
      .up()
      .ele("DatosFactura")
        .ele("DescripcionFactura").txt(invoice.descripcion).up()
        .ele("ImporteTotalFactura").txt(invoice.importeTotal.toFixed(2)).up()
        .ele("Claves")
          .ele("IDClave")
            .ele("ClaveRegimenIvaOpTrascendencia").txt("01").up()
          .up()
        .up()
      .up()
      .ele("TipoDesglose")
        .ele("DesgloseFactura")
          .ele("Sujeta")
            .ele("NoExenta")
              .ele("DetalleNoExenta")
                .ele("TipoNoExenta").txt("S1").up()
                .ele("DesgloseIVA")
                  .ele("DetalleIVA")
                    .ele("BaseImponible").txt(invoice.baseImponible.toFixed(2)).up()
                    .ele("TipoImpositivo").txt(invoice.tipoIVA.toFixed(2)).up()
                    .ele("CuotaImpuesto").txt(invoice.cuotaIVA.toFixed(2)).up()
                  .up()
                .up()
              .up()
            .up()
          .up()
        .up()
      .up();

  facturaNode.up(); // Close Factura

  // Encadenamiento con factura anterior
  const huella = doc.ele("HuellaTBAI");
  
  if (invoice.facturaAnterior) {
    huella
      .ele("EncadenamientoFacturaAnterior")
        .ele("SerieFacturaAnterior").txt(invoice.facturaAnterior.serie).up()
        .ele("NumFacturaAnterior").txt(invoice.facturaAnterior.numero).up()
        .ele("FechaExpedicionFacturaAnterior").txt(invoice.facturaAnterior.fecha).up()
        .ele("SignatureValueFirmaFacturaAnterior").txt(invoice.facturaAnterior.firma).up()
      .up();
  } else {
    huella.ele("EncadenamientoFacturaAnterior").up();
  }

  huella
    .ele("Software")
      .ele("LicenciaTBAI").txt(TICKETBAI_CONFIG.software.licencia).up()
      .ele("EntidadDesarrolladora")
        .ele("NIF").txt(TICKETBAI_CONFIG.software.nif).up()
      .up()
      .ele("Nombre").txt(TICKETBAI_CONFIG.software.nombre).up()
      .ele("Version").txt(TICKETBAI_CONFIG.software.version).up()
    .up();

  huella.up(); // Close HuellaTBAI

  const xmlStr = doc.end({ prettyPrint: true });

  // Generate signature (simplified - in production would use X.509 certificate)
  const signature = crypto
    .createHash("sha256")
    .update(xmlStr)
    .digest("base64")
    .substring(0, 100);

  // Generate QR code URL (Bizkaia format)
  const qrCode = `https://batuz.eus/TBAI/?id=${encodeURIComponent(ticketbaiId)}&s=${invoice.serie}&nf=${invoice.numero}&i=${invoice.importeTotal.toFixed(2)}&cr=${signature.substring(0, 8)}`;

  return {
    xml: xmlStr,
    ticketbaiId,
    signature,
    qrCode,
  };
}
