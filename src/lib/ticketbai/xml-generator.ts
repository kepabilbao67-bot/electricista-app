import { create } from "xmlbuilder2";
import { TICKETBAI_CONFIG } from "./config";
import type { TicketBAIInvoice, TicketBAIResponse } from "./types";
import crypto from "crypto";

/**
 * Genera el XML en formato TicketBAI compatible con Batuz (DFB - Bizkaia)
 * Este XML se puede:
 * 1. Descargar y subir manualmente a Batuz
 * 2. Enviar via API LROE cuando esté configurada
 * 
 * Formato según especificación TicketBAI v1.2 de la Diputación Foral de Bizkaia
 */
export function generateTicketBAIXml(
  invoice: TicketBAIInvoice
): TicketBAIResponse {
  const fechaFormateada = invoice.fecha.split("-").reverse().join("-"); // DD-MM-YYYY
  const ticketbaiId = `TBAI-${TICKETBAI_CONFIG.emisor.nif}-${invoice.fecha.replace(/-/g, "").substring(2)}-${invoice.serie}${invoice.numero}`;

  // Construir XML según esquema TicketBAI v1.2
  const root = create({ version: "1.0", encoding: "UTF-8" })
    .ele("T:TicketBai", {
      "xmlns:T": "urn:ticketbai:emision",
      "xmlns:ds": "http://www.w3.org/2000/09/xmldsig#",
    });

  // Cabecera
  root.ele("Cabecera")
    .ele("IDVersionTBAI").txt(TICKETBAI_CONFIG.version).up()
  .up();

  // Sujetos
  const sujetos = root.ele("Sujetos");
  
  // Emisor
  sujetos.ele("Emisor")
    .ele("NIF").txt(invoice.emisor.nif).up()
    .ele("ApellidosNombreRazonSocial").txt(invoice.emisor.nombre).up()
  .up();

  // Destinatarios
  if (invoice.destinatario && invoice.destinatario.nif) {
    const dest = sujetos.ele("Destinatarios").ele("IDDestinatario");
    dest.ele("NIF").txt(invoice.destinatario.nif).up();
    dest.ele("ApellidosNombreRazonSocial").txt(invoice.destinatario.nombre).up();
    if (invoice.destinatario.codigoPostal) {
      dest.ele("CodigoPostal").txt(invoice.destinatario.codigoPostal).up();
    }
    if (invoice.destinatario.direccion) {
      dest.ele("Direccion").txt(invoice.destinatario.direccion).up();
    }
    dest.up().up(); // close IDDestinatario, Destinatarios
  }

  sujetos.up(); // close Sujetos

  // Factura
  const factura = root.ele("Factura");

  // CabeceraFactura
  factura.ele("CabeceraFactura")
    .ele("SerieFactura").txt(invoice.serie).up()
    .ele("NumFactura").txt(invoice.numero).up()
    .ele("FechaExpedicionFactura").txt(fechaFormateada).up()
    .ele("HoraExpedicionFactura").txt(invoice.hora).up()
  .up();

  // DatosFactura
  const datosFactura = factura.ele("DatosFactura");
  datosFactura.ele("FechaOperacion").txt(fechaFormateada).up();
  datosFactura.ele("DescripcionFactura").txt(invoice.descripcion.substring(0, 250)).up();
  
  const detalles = datosFactura.ele("DetallesFactura");
  for (const item of invoice.detalles) {
    detalles.ele("IDDetalleFactura")
      .ele("DescripcionDetalle").txt(item.descripcion.substring(0, 250)).up()
      .ele("Cantidad").txt(item.cantidad.toFixed(2)).up()
      .ele("ImporteUnitario").txt(item.precioUnitario.toFixed(2)).up()
      .ele("ImporteTotal").txt(item.importe.toFixed(2)).up()
    .up();
  }
  detalles.up();

  datosFactura.ele("ImporteTotalFactura").txt(invoice.importeTotal.toFixed(2)).up();
  datosFactura.ele("Claves")
    .ele("IDClave")
      .ele("ClaveRegimenIvaOpTrascendencia").txt("01").up()
    .up()
  .up();
  datosFactura.up();

  // TipoDesglose
  factura.ele("TipoDesglose")
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

  factura.up(); // close Factura

  // HuellaTBAI - Encadenamiento
  const huella = root.ele("HuellaTBAI");

  if (invoice.facturaAnterior) {
    huella.ele("EncadenamientoFacturaAnterior")
      .ele("SerieFacturaAnterior").txt(invoice.facturaAnterior.serie).up()
      .ele("NumFacturaAnterior").txt(invoice.facturaAnterior.numero).up()
      .ele("FechaExpedicionFacturaAnterior").txt(invoice.facturaAnterior.fecha).up()
      .ele("SignatureValueFirmaFacturaAnterior").txt(invoice.facturaAnterior.firma.substring(0, 100)).up()
    .up();
  } else {
    huella.ele("EncadenamientoFacturaAnterior").up();
  }

  // Software garante
  huella.ele("Software")
    .ele("LicenciaTBAI").txt(TICKETBAI_CONFIG.software.licencia).up()
    .ele("EntidadDesarrolladora")
      .ele("NIF").txt(TICKETBAI_CONFIG.software.nif).up()
    .up()
    .ele("Nombre").txt(TICKETBAI_CONFIG.software.nombre).up()
    .ele("Version").txt(TICKETBAI_CONFIG.software.version).up()
  .up();

  huella.up(); // close HuellaTBAI

  const xmlStr = root.end({ prettyPrint: true });

  // Generar firma simplificada (para uso interno - Batuz genera la firma real XAdES)
  const signature = crypto
    .createHash("sha256")
    .update(xmlStr)
    .digest("base64")
    .substring(0, 100);

  // Código de verificación CRC-8 (primeros 8 chars de la firma)
  const crc = signature.substring(0, 8);

  // URL QR según formato Batuz Bizkaia
  const qrCode = `https://batuz.eus/TBAI/?id=${encodeURIComponent(ticketbaiId)}&s=${encodeURIComponent(invoice.serie)}&nf=${invoice.numero}&i=${invoice.importeTotal.toFixed(2)}&cr=${crc}`;

  return {
    xml: xmlStr,
    ticketbaiId,
    signature,
    qrCode,
  };
}

/**
 * Genera el XML LROE (Libro Registro de Operaciones Económicas)
 * para envío a Batuz - formato alta de factura emitida
 */
export function generateLROEXml(invoice: TicketBAIInvoice, ticketbaiId: string, signature: string): string {
  const fechaFormateada = invoice.fecha.split("-").reverse().join("-");

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("lrpjfecpj:LROEPJ240FacturasEmitidasConSGAltaPetworksicion", {
      "xmlns:lrpjfecpj": "https://www.batuz.eus/fitxategiak/batuz/LROE/esquemas/LROE_PJ_240_1_1_FacturasEmitidas_ConSG_AltaPeticion_V1_0_2.xsd",
    })
    .ele("Cabecera")
      .ele("Modelo").txt("240").up()
      .ele("Capitulo").txt("1").up()
      .ele("Subcapitulo").txt("1.1").up()
      .ele("Operacion").txt("A00").up()
      .ele("Version").txt("1.0").up()
      .ele("Ejercicio").txt(invoice.fecha.substring(0, 4)).up()
      .ele("ObligadoTributario")
        .ele("NIF").txt(invoice.emisor.nif).up()
        .ele("ApellidosNombreRazonSocial").txt(invoice.emisor.nombre).up()
      .up()
    .up()
    .ele("FacturasEmitidas")
      .ele("FacturaEmitida")
        .ele("TicketBai").txt(ticketbaiId).up()
        .ele("SignatureValue").txt(signature).up()
        .ele("CabeceraFactura")
          .ele("SerieFactura").txt(invoice.serie).up()
          .ele("NumFactura").txt(invoice.numero).up()
          .ele("FechaExpedicionFactura").txt(fechaFormateada).up()
        .up()
        .ele("DatosFactura")
          .ele("ImporteTotalFactura").txt(invoice.importeTotal.toFixed(2)).up()
          .ele("ClaveRegimenIVA").txt("01").up()
          .ele("BaseImponible").txt(invoice.baseImponible.toFixed(2)).up()
          .ele("TipoImpositivo").txt(invoice.tipoIVA.toFixed(2)).up()
          .ele("CuotaIVA").txt(invoice.cuotaIVA.toFixed(2)).up()
        .up()
      .up()
    .up();

  return doc.end({ prettyPrint: true });
}
