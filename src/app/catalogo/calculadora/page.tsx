"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Calculator, TrendingUp, ArrowRight, Copy, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";

interface CatalogItem {
  id: string;
  name: string;
  unit_price: number;
  cost_price: number;
  category: string | null;
}

interface CalculatorLine {
  id: number;
  description: string;
  cost_price: number;
  margin: number;
  quantity: number;
}

export default function CalculadoraPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [lines, setLines] = useState<CalculatorLine[]>([
    { id: 1, description: "", cost_price: 0, margin: 100, quantity: 1 },
  ]);
  const [defaultMargin, setDefaultMargin] = useState(100);
  const [nextId, setNextId] = useState(2);

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((data) => {
      setCatalog(Array.isArray(data) ? data : []);
    });
  }, []);

  const addLine = () => {
    setLines([...lines, { id: nextId, description: "", cost_price: 0, margin: defaultMargin, quantity: 1 }]);
    setNextId(nextId + 1);
  };

  const removeLine = (id: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((l) => l.id !== id));
  };

  const updateLine = (id: number, field: keyof CalculatorLine, value: string | number) => {
    setLines(lines.map((l) => l.id === id ? { ...l, [field]: value } : l));
  };

  const addFromCatalog = (item: CatalogItem) => {
    const existingLine = lines.find((l) => l.description === item.name);
    if (existingLine) {
      setLines(lines.map((l) => l.id === existingLine.id ? { ...l, quantity: l.quantity + 1 } : l));
    } else {
      const margin = item.cost_price > 0 ? Math.round(((item.unit_price - item.cost_price) / item.cost_price) * 100) : defaultMargin;
      const lastEmpty = lines[lines.length - 1];
      if (lastEmpty && !lastEmpty.description && lastEmpty.cost_price === 0) {
        setLines(lines.map((l) => l.id === lastEmpty.id ? { ...l, description: item.name, cost_price: item.cost_price || 0, margin, quantity: 1 } : l));
      } else {
        setLines([...lines, { id: nextId, description: item.name, cost_price: item.cost_price || 0, margin, quantity: 1 }]);
        setNextId(nextId + 1);
      }
    }
  };

  const getSellPrice = (line: CalculatorLine) => line.cost_price * (1 + line.margin / 100);
  const getLineTotal = (line: CalculatorLine) => getSellPrice(line) * line.quantity;
  const totalCoste = lines.reduce((acc, l) => acc + l.cost_price * l.quantity, 0);
  const totalVenta = lines.reduce((acc, l) => acc + getLineTotal(l), 0);
  const totalBeneficio = totalVenta - totalCoste;
  const totalConIVA = totalVenta * 1.21;

  const copyAsText = () => {
    const text = lines
      .filter((l) => l.description && l.cost_price > 0)
      .map((l) => `${l.description} x${l.quantity} → ${getSellPrice(l).toFixed(2)}€/ud (Total: ${getLineTotal(l).toFixed(2)}€)`)
      .join("\n") + `\n\nSubtotal: ${totalVenta.toFixed(2)}€\nIVA 21%: ${(totalVenta * 0.21).toFixed(2)}€\nTOTAL: ${totalConIVA.toFixed(2)}€`;
    navigator.clipboard.writeText(text);
    showToast("success", "Copiado al portapapeles");
  };

  const saveToPresupuesto = () => {
    const items = lines
      .filter((l) => l.description && l.cost_price > 0)
      .map((l) => ({ description: l.description, quantity: l.quantity, unit_price: parseFloat(getSellPrice(l).toFixed(2)) }));
    
    if (items.length === 0) return;
    // Store in sessionStorage for the presupuesto page to read
    sessionStorage.setItem("presupuesto_items", JSON.stringify(items));
    showToast("success", "Items guardados. Ve a crear presupuesto.");
    router.push("/presupuestos/nuevo");
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calculadora de precios</h1>
          <p className="text-sm text-slate-500">Mete lo que te cuesta el material y te calcula cuanto cobrar al cliente</p>
        </div>
      </div>

      {/* Margen por defecto */}
      <div className="card mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Margen por defecto:</label>
          <input
            type="number"
            min="0"
            max="500"
            value={defaultMargin}
            onChange={(e) => setDefaultMargin(parseInt(e.target.value) || 100)}
            className="input-field w-20 text-center !py-1.5"
          />
          <span className="text-sm text-slate-500">%</span>
        </div>
        <div className="text-xs text-slate-400">
          100% = precio x2 | 50% = precio x1.5 | 200% = precio x3
        </div>
      </div>

      {/* Catálogo rápido */}
      {catalog.length > 0 && (
        <div className="card mb-6 border-indigo-100">
          <p className="text-xs font-medium text-slate-500 mb-2">Añadir del catalogo (con precio de compra):</p>
          <div className="flex flex-wrap gap-1.5">
            {catalog.filter((c) => c.cost_price > 0).map((item) => (
              <button
                key={item.id}
                onClick={() => addFromCatalog(item)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all"
              >
                {item.name} ({item.cost_price}€ → {item.unit_price}€)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lines */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Materiales</h2>
          <button onClick={addLine} className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            <Plus className="h-3 w-3" /> Linea
          </button>
        </div>

        {/* Header */}
        <div className="hidden md:grid grid-cols-12 gap-2 mb-2 px-1">
          <div className="col-span-4 text-xs font-medium text-slate-500">Material</div>
          <div className="col-span-2 text-xs font-medium text-slate-500 text-center">Precio compra</div>
          <div className="col-span-1 text-xs font-medium text-slate-500 text-center">Margen %</div>
          <div className="col-span-2 text-xs font-medium text-slate-500 text-center">Precio venta</div>
          <div className="col-span-1 text-xs font-medium text-slate-500 text-center">Cant.</div>
          <div className="col-span-2 text-xs font-medium text-slate-500 text-right">Total cliente</div>
        </div>

        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-slate-50/50 border border-slate-100">
              <div className="col-span-12 md:col-span-4">
                <input
                  type="text"
                  placeholder="Descripcion material"
                  value={line.description}
                  onChange={(e) => updateLine(line.id, "description", e.target.value)}
                  className="input-field !py-1.5 text-sm w-full"
                />
              </div>
              <div className="col-span-4 md:col-span-2">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Coste"
                    value={line.cost_price || ""}
                    onChange={(e) => updateLine(line.id, "cost_price", parseFloat(e.target.value) || 0)}
                    className="input-field !py-1.5 text-sm text-center text-red-600 font-medium w-full"
                  />
                </div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={line.margin}
                  onChange={(e) => updateLine(line.id, "margin", parseInt(e.target.value) || 0)}
                  className="input-field !py-1.5 text-sm text-center w-full"
                />
              </div>
              <div className="col-span-3 md:col-span-2 flex items-center justify-center gap-1">
                <ArrowRight className="h-3 w-3 text-slate-400 hidden md:block" />
                <span className="text-sm font-bold text-emerald-700">{getSellPrice(line).toFixed(2)}€</span>
              </div>
              <div className="col-span-2 md:col-span-1">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.id, "quantity", parseInt(e.target.value) || 1)}
                  className="input-field !py-1.5 text-sm text-center w-full"
                />
              </div>
              <div className="col-span-1 md:col-span-2 flex items-center justify-end gap-2">
                <span className="text-sm font-bold text-slate-900">{getLineTotal(line).toFixed(2)}€</span>
                <button onClick={() => removeLine(line.id)} className="text-slate-400 hover:text-red-500">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totales */}
      <div className="card bg-gradient-to-br from-slate-50 to-white mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-lg bg-red-50 border border-red-100">
            <p className="text-xs text-red-500 font-medium">Tu coste total</p>
            <p className="text-xl font-bold text-red-700">{totalCoste.toFixed(2)}€</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-emerald-50 border border-emerald-100">
            <p className="text-xs text-emerald-500 font-medium">Cobras al cliente (sin IVA)</p>
            <p className="text-xl font-bold text-emerald-700">{totalVenta.toFixed(2)}€</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-indigo-50 border border-indigo-100">
            <p className="text-xs text-indigo-500 font-medium">Tu beneficio</p>
            <p className="text-xl font-bold text-indigo-700">{totalBeneficio.toFixed(2)}€</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-slate-800">
            <p className="text-xs text-slate-400 font-medium">Total + IVA 21%</p>
            <p className="text-xl font-bold text-white">{totalConIVA.toFixed(2)}€</p>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-3">
        <button onClick={copyAsText} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Copy className="h-4 w-4" />
          Copiar precios
        </button>
        <button onClick={saveToPresupuesto} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
          <TrendingUp className="h-4 w-4" />
          Usar en presupuesto
        </button>
      </div>

      {/* Tip */}
      <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-sm text-amber-800">
          <strong>Tip:</strong> Con margen 100% (x2), si compras un magnetotermico a 18€ en Sokoel, cobras 36€ al cliente.
          Ajusta el margen segun el tipo de trabajo y material.
        </p>
      </div>
    </div>
  );
}
