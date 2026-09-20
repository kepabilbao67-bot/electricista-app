export interface SupplierCatalogItem {
  id: string;
  reference: string;
  name: string;
  description: string;
  costPrice: number;
  category: string;
  supplier: "SOKOEL";
  priceDate: "2026-08-24";
  sourceDocument: "Oferta 100790";
}

const item = (
  reference: string,
  description: string,
  costPrice: number,
  category: string
): SupplierCatalogItem => ({
  id: `sokoel-100790-${reference.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
  reference,
  name: description,
  description: `Referencia ${reference}. Coste neto de proveedor; precio de venta sin configurar.`,
  costPrice,
  category,
  supplier: "SOKOEL",
  priceDate: "2026-08-24",
  sourceDocument: "Oferta 100790",
});

export const SOKOEL_CATALOG_ITEMS: SupplierCatalogItem[] = [
  item("N2100 BL", "N N2100 BL TAPA CIEGA", 1.49, "Mecanismos"),
  item("N2271.1 BL", "N N2271 1 BL PLACA 1 ELEM", 1.1185, "Mecanismos"),
  item("N2272.1 BL", "N N2272 1 BL PLACA 2 ELEM", 2.256, "Mecanismos"),
  item("N2273.1 BL", "N N2273 1 BL MARCO BASICO 3 VENTANAS", 3.341, "Mecanismos"),
  item("N2274.1 BL", "N N2274 1 BL MARCO BASICO 4 VENTANAS", 4.5125, "Mecanismos"),
  item("N2250.1 BL", "N N2250 1 BL TAPA TOMA TV R SAT", 1.22, "Mecanismos"),
  item("N2218.1 BL", "N N2218 1 BL TAPA VENTANA 1 CONECTOR", 2.2, "Mecanismos"),
  item("N2118.1 BL", "N N2118 1 BL TAPA CON VENTANA 1 RJ45", 2.005, "Mecanismos"),
  item("N2202 BL", "N N2202 BL CONMUTADOR", 2.7643, "Mecanismos"),
  item("N2288 BL", "N N2288 BL BASE SCHUKO", 3.0289, "Mecanismos"),
  item("110", "REGLETA 110 CORTE RAPIDO 10 MM", 1.745, "Conexion"),
  item("HPS 6", "REGLETA HPS-6 DE 12 BORNES", 5.86, "Conexion"),
  item("HPS 10", "REGLETA HPS-10 DE 12 BORNES", 7.32, "Conexion"),
  item("HPS 16", "REGLETA HPS-16 DE 12 BORNES", 8.75, "Conexion"),
  item("5082", "CINTA PVC 20X19 AIN Nº12 NEGRA", 1.04, "Material auxiliar"),
  item("2225-0", "UNEX 2225.0 BRIDA 190X2,5 N", 0.0323, "Material auxiliar"),
  item("N2473.9", "N N2473 9 BASTIDOR 3 ELEM", 0.6238, "Mecanismos"),
  item("N2271.9", "N N2271 9 BASTIDOR 1 ELEM", 0.456, "Mecanismos"),
  item("N2472.1 BL", "N N2472.1 BL PLACA BASICA 2M BL", 1.56, "Mecanismos"),
  item("N2473.1 BL", "N N2473.1 BL PLACA BASICA 3M", 1.62, "Mecanismos"),
  item("8024", "PROLONGADOR 2MTS 4T SOLERA 8024", 12.43, "Material electrico"),
  item("2CDS251190R0104", "AEG MAGNETO EV60 1P+N 10A C 2CDS251190R0104", 3.22, "Proteccion"),
  item("2CDS251190R0164", "AEG MAGNETO EV60 1P+N 16A C 2CDS251190R0164", 3.22, "Proteccion"),
  item("2CDS251190R0204", "AEG MAGNETO EV60 1P+N 20A C 2CDS251190R0204", 3.22, "Proteccion"),
  item("2CDS251190R0254", "AEG MAGNETO EV60 1P+N 25A C 2CDS251190R0254", 3.22, "Proteccion"),
  item("2CDS251190R0324", "AEG MAGNETO EV60 1P+N 32A C 2CDS251190R0324", 5.47, "Proteccion"),
  item("2CSF202072R1400", "AEG DIFERENCIAL DV 2P 40A 30MA AC 2CSF202072R1400", 12.51, "Proteccion"),
  item("77706517", "PROT SOBRE T+P + 2P 40A 77706517", 127.09, "Proteccion"),
  item("TD-603UT-D-LBR", "KYN TD-603UT-D-LBR CAT.6 U/UTP 24AW DCA LSZH BLANCO", 0.4081, "Cableado"),
  item("214110", "CABLE COAX. T100PLUS LSFH DCA BL 100M RG6", 0.798, "Cableado"),
  item("DFF54PO", "CAJA DISTRIBUCION IP40 EMPOTRAR PARED SOLIDA 3X18 (54)", 28.82, "Cuadros"),
  item("RTR50608PLAS", "RTR ICT 500X600X80 EMP. RTR50608PLAS", 47.03, "Cuadros"),
];
