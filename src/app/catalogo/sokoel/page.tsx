import {
  SOKOEL_CATALOG,
  SOKOEL_DOCUMENT_SUBTOTAL,
  SOKOEL_DOCUMENT_TOTAL,
  SOKOEL_DOCUMENT_VAT,
  SOKOEL_DOCUMENT_VAT_RATE,
  SOKOEL_PRICE_DATE,
  SOKOEL_SOURCE_DOCUMENT,
  SOKOEL_SUPPLIER,
} from "@/lib/sokoel-catalog";

function eur(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export default function SokoelCatalogPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Catálogo SOKOEL</h1>
            <p className="text-sm text-slate-500">
              {SOKOEL_SOURCE_DOCUMENT} · precio proveedor {SOKOEL_PRICE_DATE}
            </p>
          </div>
          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
            Precio de venta pendiente
          </span>
        </div>
        <p className="text-sm text-slate-600">
          Estos importes son costes netos de proveedor. No se ha inventado ningún precio de venta.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Proveedor</p>
          <p className="mt-1 font-semibold text-slate-900">{SOKOEL_SUPPLIER}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Productos</p>
          <p className="mt-1 font-semibold text-slate-900">{SOKOEL_CATALOG.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Base oferta</p>
          <p className="mt-1 font-semibold text-slate-900">{eur(SOKOEL_DOCUMENT_SUBTOTAL)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total oferta</p>
          <p className="mt-1 font-semibold text-slate-900">{eur(SOKOEL_DOCUMENT_TOTAL)}</p>
          <p className="text-xs text-slate-500">IVA {SOKOEL_DOCUMENT_VAT_RATE}%: {eur(SOKOEL_DOCUMENT_VAT)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Referencia</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Descripción</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Coste proveedor</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Venta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SOKOEL_CATALOG.map((item) => (
                <tr key={item.supplierReference} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                    {item.supplierReference}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    <p className="font-medium">{item.description}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Oferta: {item.quantityOffer} · dto. {item.discountPct}%
                      {item.tariffUnit ? ` · tarifa ${item.tariffUnit}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                    {eur(item.costPrice)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Precio pendiente
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
