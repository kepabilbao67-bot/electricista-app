"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/Toast";
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

type SokoelRow = {
  supplierReference: string;
  description: string;
  quantityOffer: number;
  tariffPrice: number;
  tariffUnit?: "C" | "M";
  discountPct: number;
  netLineAmount: number;
  costPrice: number;
  supplier: string;
  priceDate: string;
  sourceDocument: string;
  catalogId: string;
  imported: boolean;
  salePrice: number | null;
};

function eur(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function initialRows(): SokoelRow[] {
  return SOKOEL_CATALOG.map((item) => ({
    ...item,
    supplier: SOKOEL_SUPPLIER,
    priceDate: SOKOEL_PRICE_DATE,
    sourceDocument: SOKOEL_SOURCE_DOCUMENT,
    catalogId: `sokoel:${item.supplierReference}`,
    imported: false,
    salePrice: null,
  }));
}

export default function SokoelCatalogPage() {
  const [rows, setRows] = useState<SokoelRow[]>(initialRows);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingRef, setSavingRef] = useState<string | null>(null);
  const [databaseAvailable, setDatabaseAvailable] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/catalog/sokoel", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) throw new Error("No se pudo cargar SOKOEL");
      setRows(data);
      setDatabaseAvailable(true);
      setPrices((current) => {
        const next = { ...current };
        for (const item of data as SokoelRow[]) {
          if (item.salePrice && !next[item.supplierReference]) {
            next[item.supplierReference] = String(item.salePrice);
          }
        }
        return next;
      });
    } catch {
      setDatabaseAvailable(false);
      setRows(initialRows());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveToCatalog = async (item: SokoelRow) => {
    const unitPrice = Number(prices[item.supplierReference]);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      showToast("error", "Introduce un precio de venta mayor que 0");
      return;
    }

    setSavingRef(item.supplierReference);
    try {
      const response = await fetch("/api/catalog/sokoel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierReference: item.supplierReference,
          unit_price: unitPrice,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        showToast("error", data?.error || "No se pudo guardar el producto");
        return;
      }
      showToast(
        "success",
        item.imported ? "Precio de venta actualizado" : "Producto añadido al catálogo de venta"
      );
      await load();
    } catch {
      showToast("error", "No se pudo guardar el producto");
    } finally {
      setSavingRef(null);
    }
  };

  const importedCount = rows.filter((item) => item.imported).length;

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
            {importedCount}/32 con precio de venta
          </span>
        </div>
        <p className="text-sm text-slate-600">
          El coste de proveedor ya está cargado. Un producto solo pasa al catálogo de venta cuando introduces un precio mayor que 0 €.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Proveedor</p>
          <p className="mt-1 font-semibold text-slate-900">{SOKOEL_SUPPLIER}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Productos</p>
          <p className="mt-1 font-semibold text-slate-900">32</p>
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

      {!databaseAvailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Los 32 productos se muestran desde la oferta guardada, pero la base de datos del preview no está disponible. No se guardará ningún precio hasta que la conexión de catálogo esté operativa.
        </div>
      )}

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Seguridad: mientras el precio de venta esté pendiente, el producto no se inserta en <strong>catalog_items</strong> y no puede seleccionarse desde presupuestos o facturas como artículo de 0 €.
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Referencia</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Descripción</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Coste</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Venta</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">Comprobando catálogo…</td>
                </tr>
              ) : rows.map((item) => (
                <tr key={item.supplierReference} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                    {item.supplierReference}
                  </td>
                  <td className="px-4 py-3 text-slate-800 min-w-72">
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
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={prices[item.supplierReference] ?? ""}
                      onChange={(event) => setPrices((current) => ({
                        ...current,
                        [item.supplierReference]: event.target.value,
                      }))}
                      placeholder="Precio venta"
                      className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-right"
                    />
                    <div className="mt-1 text-xs">
                      {item.imported ? (
                        <span className="font-semibold text-emerald-700">En catálogo · {eur(item.salePrice || 0)}</span>
                      ) : (
                        <span className="font-semibold text-amber-700">Precio pendiente</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={!databaseAvailable || savingRef === item.supplierReference}
                      onClick={() => void saveToCatalog(item)}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {savingRef === item.supplierReference
                        ? "Guardando…"
                        : item.imported
                          ? "Actualizar venta"
                          : "Añadir a venta"}
                    </button>
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
