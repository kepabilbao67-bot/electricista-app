export interface TicketBAIInvoice {
  serie: string;
  numero: string;
  fecha: string;
  hora: string;
  descripcion: string;
  emisor: {
    nif: string;
    nombre: string;
  };
  destinatario?: {
    nif: string;
    nombre: string;
    direccion?: string;
    codigoPostal?: string;
    municipio?: string;
    provincia?: string;
  };
  detalles: TicketBAIDetalle[];
  importeTotal: number;
  baseImponible: number;
  cuotaIVA: number;
  tipoIVA: number;
  facturaAnterior?: {
    serie: string;
    numero: string;
    fecha: string;
    firma: string;
  };
}

export interface TicketBAIDetalle {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
}

export interface TicketBAIResponse {
  xml: string;
  ticketbaiId: string;
  signature: string;
  qrCode: string;
}

export interface TicketBAIChainData {
  serie: string;
  numero: string;
  fecha: string;
  firma: string;
}
