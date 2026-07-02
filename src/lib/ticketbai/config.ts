export const TICKETBAI_CONFIG = {
  // Datos del emisor
  emisor: {
    nif: "16063731W",
    nombre: "MARTIN OYARZABAL, IVAN",
    direccion: "Lehendakari Aguirre 7b 2 derecha",
    codigoPostal: "48640",
    municipio: "Berango",
    provincia: "Bizkaia",
    pais: "ES",
  },
  // Configuracion TicketBAI para Bizkaia (DFB - Diputacion Foral de Bizkaia)
  territorio: "01" as const, // 01 = Bizkaia
  entidad: "DFB",
  version: "1.2",
  // Serie de facturas
  serie: "DFB_",
  // Software garante
  software: {
    licencia: "TBAI00000000000000",
    nif: "16063731W",
    nombre: "ElectricistApp",
    version: "1.0",
  },
  // IVA por defecto
  tipoIVA: 21,
};
