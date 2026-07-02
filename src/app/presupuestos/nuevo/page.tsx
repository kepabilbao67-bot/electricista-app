"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { showToast } from "@/components/Toast";

interface Client {
  id: string;
  name: string;
}

interface CatalogItem {
  id: string;
  name: string;
  unit_price: number;
  category: string;
}

interface BudgetItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export default function NuevoPresupuestoPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<BudgetItem[]>([
    { description: "", quantity: 1, unit_price: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then(setClients);
    fetch("/api/catalog").then((r) => r.json()).then(setCatalog);
  }, []);

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof BudgetItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addFromCatalog = (catalogItem: CatalogItem) => {
    // Si ya existe una línea con el mismo nombre, incrementar cantidad en 1
    const existingIndex = items.findIndex(
      (item) => item.description === catalogItem.name && item.unit_price === catalogItem.unit_price
    );

    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: newItems[existingIndex].quantity + 1,
      };
      setItems(newItems);
    } else {
      // Si la última línea está vacía, reemplazarla
      const lastItem = items[items.length - 1];
      if (lastItem && !lastItem.description && lastItem.unit_price === 0) {
        const newItems = [...items];
        newItems[newItems.length - 1] = {
          description: catalogItem.name,
          quantity: 1,
          unit_price: catalogItem.unit_price,
        };
        setItems(newItems);
      } else {
        setItems([
          ...items,
          { description: catalogItem.name, quantity: 1, unit_price: catalogItem.unit_price },
        ]);
      }
    }
  };

  const subtotal = items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  const taxAmount = subtotal * 0.21;
  const total = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || items.length === 0) return;
    setSubmitting(true);

    const res = await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        date,
        valid_until: validUntil || null,
        notes,
        tax_rate: 21,
        items: items.filter((i) => i.description && i.unit_price > 0),
      }),
    });

    if (res.ok) {
      const budget = await res.json();
      showToast("success", `Presupuesto ${budget.number} creado`);
      router.push(`/presupuestos/${budget.id}`);
    } else {
      showToast("error", "Error al crear el presupuesto");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="page-title mb-6">Nuevo presupuesto</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Datos generales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cliente *</label>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="input-field"
              >
                <option value="">Seleccionar cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Valido hasta</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Lineas de detalle</h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <Plus className="h-3 w-3" /> Linea
            </button>
          </div>

          {catalog.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500 mb-2">Agregar desde catalogo:</p>
              <div className="flex flex-wrap gap-2">
                {catalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addFromCatalog(item)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                  >
                    {item.name} ({item.unit_price} EUR)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Descripcion"
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="Cant."
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                    className="input-field"
                  />
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Precio"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                    className="input-field"
                  />
                </div>
                <div className="w-24 text-right py-2 text-sm font-medium text-slate-700">
                  {(item.quantity * item.unit_price).toFixed(2)} EUR
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4 text-right space-y-1">
            <p className="text-sm text-slate-500">Subtotal: {subtotal.toFixed(2)} EUR</p>
            <p className="text-sm text-slate-500">IVA 21%: {taxAmount.toFixed(2)} EUR</p>
            <p className="text-xl font-bold text-slate-900">Total: {total.toFixed(2)} EUR</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? "Creando..." : "Crear presupuesto"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
