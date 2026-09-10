export type SokoelCatalogItem = {
  supplierReference: string;
  description: string;
  quantityOffer: number;
  tariffPrice: number;
  tariffUnit?: "C" | "M";
  discountPct: number;
  netLineAmount: number;
  costPrice: number;
};

export const SOKOEL_SUPPLIER = "SOKOEL";
export const SOKOEL_PRICE_DATE = "2026-08-24";
export const SOKOEL_SOURCE_DOCUMENT = "Oferta 100790";
export const SOKOEL_DOCUMENT_SUBTOTAL = 694.7;
export const SOKOEL_DOCUMENT_VAT_RATE = 21;
export const SOKOEL_DOCUMENT_VAT = 145.89;
export const SOKOEL_DOCUMENT_TOTAL = 840.59;

/**
 * Catálogo de proveedor extraído de la oferta SOKOEL 100790 (24/08/2026).
 * costPrice es el coste neto unitario de proveedor, calculado como
 * netLineAmount / quantityOffer. No contiene precios de venta.
 */
export const SOKOEL_CATALOG: readonly SokoelCatalogItem[] = [
  { supplierReference: "N2100 BL", description: "N N2100 BL TAPA CIEGA", quantityOffer: 1, tariffPrice: 3.11, discountPct: 52, netLineAmount: 1.49, costPrice: 1.49 },
  { supplierReference: "N2271.1 BL", description: "N N2271 1 BL PLACA 1 ELEM", quantityOffer: 20, tariffPrice: 2.33, discountPct: 52, netLineAmount: 22.37, costPrice: 1.1185 },
  { supplierReference: "N2272.1 BL", description: "N N2272 1 BL PLACA 2 ELEM", quantityOffer: 15, tariffPrice: 4.70, discountPct: 52, netLineAmount: 33.84, costPrice: 2.256 },
  { supplierReference: "N2273.1 BL", description: "N N2273 1 BL MARCO BASICO 3 VENTANAS", quantityOffer: 10, tariffPrice: 6.96, discountPct: 52, netLineAmount: 33.41, costPrice: 3.341 },
  { supplierReference: "N2274.1 BL", description: "N N2274 1 BL MARCO BASICO 4 VENTANAS", quantityOffer: 4, tariffPrice: 9.40, discountPct: 52, netLineAmount: 18.05, costPrice: 4.5125 },
  { supplierReference: "N2250.1 BL", description: "N N2250 1 BL TAPA TOMA TV R SAT", quantityOffer: 4, tariffPrice: 2.54, discountPct: 52, netLineAmount: 4.88, costPrice: 1.22 },
  { supplierReference: "N2218.1 BL", description: "N N2218 1 BL TAPA VENTANA 1 CONECTOR", quantityOffer: 2, tariffPrice: 4.58, discountPct: 52, netLineAmount: 4.40, costPrice: 2.20 },
  { supplierReference: "N2118.1 BL", description: "N N2118 1 BL TAPA CON VENTANA 1 RJ45", quantityOffer: 2, tariffPrice: 4.18, discountPct: 52, netLineAmount: 4.01, costPrice: 2.005 },
  { supplierReference: "N2202 BL", description: "N N2202 BL CONMUTADOR", quantityOffer: 7, tariffPrice: 5.76, discountPct: 52, netLineAmount: 19.35, costPrice: 2.7642857143 },
  { supplierReference: "N2288 BL", description: "N N2288 BL BASE SCHUKO", quantityOffer: 9, tariffPrice: 6.31, discountPct: 52, netLineAmount: 27.26, costPrice: 3.0288888889 },
  { supplierReference: "110", description: "REGLETA 110 CORTE RAPIDO 10 MM", quantityOffer: 10, tariffPrice: 349.00, tariffUnit: "C", discountPct: 50, netLineAmount: 17.45, costPrice: 1.745 },
  { supplierReference: "HPS 6", description: "REGLETA HPS-6 DE 12 BORNES", quantityOffer: 1, tariffPrice: 11.72, discountPct: 50, netLineAmount: 5.86, costPrice: 5.86 },
  { supplierReference: "HPS 10", description: "REGLETA HPS-10 DE 12 BORNES", quantityOffer: 1, tariffPrice: 14.64, discountPct: 50, netLineAmount: 7.32, costPrice: 7.32 },
  { supplierReference: "HPS 16", description: "REGLETA HPS-16 DE 12 BORNES", quantityOffer: 1, tariffPrice: 17.49, discountPct: 50, netLineAmount: 8.75, costPrice: 8.75 },
  { supplierReference: "5082", description: "CINTA PVC 20X19 AIN Nº12 NEGRA", quantityOffer: 1, tariffPrice: 1.79, discountPct: 42, netLineAmount: 1.04, costPrice: 1.04 },
  { supplierReference: "2225-0", description: "UNEX 2225.0 BRIDA 190X2,5 N", quantityOffer: 200, tariffPrice: 5.12, tariffUnit: "C", discountPct: 37, netLineAmount: 6.45, costPrice: 0.03225 },
  { supplierReference: "N2473.9", description: "N N2473 9 BASTIDOR 3 ELEM", quantityOffer: 8, tariffPrice: 1.30, discountPct: 52, netLineAmount: 4.99, costPrice: 0.62375 },
  { supplierReference: "N2271.9", description: "N N2271 9 BASTIDOR 1 ELEM", quantityOffer: 20, tariffPrice: 0.95, discountPct: 52, netLineAmount: 9.12, costPrice: 0.456 },
  { supplierReference: "N2472.1 BL", description: "N N2472.1 BL PLACA BASICA 2M BL", quantityOffer: 7, tariffPrice: 3.25, discountPct: 52, netLineAmount: 10.92, costPrice: 1.56 },
  { supplierReference: "N2473.1 BL", description: "N N2473.1 BL PLACA BASICA 3M", quantityOffer: 2, tariffPrice: 3.37, discountPct: 52, netLineAmount: 3.24, costPrice: 1.62 },
  { supplierReference: "8024", description: "PROLONGADOR 2MTS 4T SOLERA 8024", quantityOffer: 1, tariffPrice: 24.85, discountPct: 50, netLineAmount: 12.43, costPrice: 12.43 },
  { supplierReference: "2CDS251190R0104", description: "AEG MAGNETO EV60 1P+N 10A C 2CDS251190R0104", quantityOffer: 1, tariffPrice: 21.44, discountPct: 85, netLineAmount: 3.22, costPrice: 3.22 },
  { supplierReference: "2CDS251190R0164", description: "AEG MAGNETO EV60 1P+N 16A C 2CDS251190R0164", quantityOffer: 1, tariffPrice: 21.44, discountPct: 85, netLineAmount: 3.22, costPrice: 3.22 },
  { supplierReference: "2CDS251190R0204", description: "AEG MAGNETO EV60 1P+N 20A C 2CDS251190R0204", quantityOffer: 1, tariffPrice: 21.44, discountPct: 85, netLineAmount: 3.22, costPrice: 3.22 },
  { supplierReference: "2CDS251190R0254", description: "AEG MAGNETO EV60 1P+N 25A C 2CDS251190R0254", quantityOffer: 1, tariffPrice: 21.44, discountPct: 85, netLineAmount: 3.22, costPrice: 3.22 },
  { supplierReference: "2CDS251190R0324", description: "AEG MAGNETO EV60 1P+N 32A C 2CDS251190R0324", quantityOffer: 1, tariffPrice: 36.44, discountPct: 85, netLineAmount: 5.47, costPrice: 5.47 },
  { supplierReference: "2CSF202072R1400", description: "AEG DIFERENCIAL DV 2P 40A 30MA AC 2CSF202072R1400", quantityOffer: 1, tariffPrice: 83.41, discountPct: 85, netLineAmount: 12.51, costPrice: 12.51 },
  { supplierReference: "77706517", description: "PROT SOBRE T+P + 2P 40A 77706517", quantityOffer: 1, tariffPrice: 201.73, discountPct: 37, netLineAmount: 127.09, costPrice: 127.09 },
  { supplierReference: "TD-603UT-D-LBR", description: "KYN TD-603UT-D-LBR CAT.6 U/UTP 24AW DCA LSZH BLANCO", quantityOffer: 305, tariffPrice: 770.00, tariffUnit: "M", discountPct: 47, netLineAmount: 124.47, costPrice: 0.4080983607 },
  { supplierReference: "214110", description: "CABLE COAX. T100PLUS LSFH DCA BL 100M RG6", quantityOffer: 100, tariffPrice: 1330.00, tariffUnit: "M", discountPct: 40, netLineAmount: 79.80, costPrice: 0.798 },
  { supplierReference: "DFF54PO", description: "CAJA DISTRIBUCION IP40 EMPOTRAR PARED SOLIDA 3X18 (54)", quantityOffer: 1, tariffPrice: 52.40, discountPct: 45, netLineAmount: 28.82, costPrice: 28.82 },
  { supplierReference: "RTR50608PLAS", description: "RTR ICT 500X600X80 EMP. RTR50608PLAS", quantityOffer: 1, tariffPrice: 85.51, discountPct: 45, netLineAmount: 47.03, costPrice: 47.03 },
] as const;

export function getSokoelDocumentSubtotal(): number {
  return Number(SOKOEL_CATALOG.reduce((sum, item) => sum + item.netLineAmount, 0).toFixed(2));
}

export function hasUniqueSokoelReferences(): boolean {
  return new Set(SOKOEL_CATALOG.map((item) => item.supplierReference)).size === SOKOEL_CATALOG.length;
}
