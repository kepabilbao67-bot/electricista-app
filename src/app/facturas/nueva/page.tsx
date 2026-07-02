"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Shield, FileCode } from "lucide-react";

interface Client {
  id: string;
  name: string;
}

interface CatalogItem {
  id: string;
  name: string;
  unit_price: number;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export default function NuevaFacturaPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unit_price: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  // TicketBAI fields
  const [ticketbaiDescription, setTicketbaiDescription] = useState("Servicios electricos");
  const [ticketbaiTipoOperacion, setTicketbaiTipoOperacion] = useState("prestacion_servicios");
  const [autoGenerateTbai, setAutoGenerateTbai] = useState(false);

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

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addFromCatalog = (catalogItem: CatalogItem) => {
    // Si ya existe una línea con el mismo nombre, incrementar cantidad
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

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        date,
        notes,
        tax_rate: 21,
        items: items.filter((i) => i.description && i.unit_price > 0),
        ticketbai_description: ticketbaiDescription,
        ticketbai_tipo_operacion: ticketbaiTipoOperacion,
        auto_generate_tbai: autoGenerateTbai,
      }),
    });

    if (res.ok) {
      const invoice = await res.json();
      router.push(`/facturas/${invoice.id}`);
    } else {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="page-title">Nueva factura</h1>
          <p className="page-subtitle">Crea una nueva factura para tu cliente</p>
        </div>
      </div>

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
            <div className="md:col-span-2">
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
              className="btn-secondary !py-1.5 !px-3 text-xs"
            >
              <Plus className="h-3 w-3" /> Linea
            </button>
          </div>

          {catalog.length > 0 && (
            <div className="mb-5 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-2">Agregar desde catalogo:</p>
              <div className="flex flex-wrap gap-2">
                {catalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addFromCatalog(item)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all duration-200 shadow-sm"
                  >
                    {item.name} ({item.unit_price} EUR)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex gap-3 items-start p-3 rounded-lg border border-slate-100 bg-slate-50/50">
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
                <div className="w-24 text-right py-2 text-sm font-semibold text-slate-700">
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
            <p className="text-sm text-slate-500">Subtotal: <span className="font-medium text-slate-700">{subtotal.toFixed(2)} EUR</span></p>
            <p className="text-sm text-slate-500">IVA 21%: <span className="font-medium text-slate-700">{taxAmount.toFixed(2)} EUR</span></p>
            <p className="text-xl font-bold text-slate-900 mt-2">Total: {total.toFixed(2)} EUR</p>
          </div>
        </div>

        {/* TicketBAI Section */}
        <div className="card border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
              <Shield className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Datos TicketBAI</h2>
              <p className="text-xs text-slate-500">Configuracion para la emision fiscal obligatoria</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <FileCode className="h-3.5 w-3.5 inline-block mr-1 text-slate-400" />
                Descripcion de la operacion
              </label>
              <input
                type="text"
                value={ticketbaiDescription}
                onChange={(e) => setTicketbaiDescription(e.target.value)}
                placeholder="Servicios electricos"
                className="input-field"
              />
              <p className="text-xs text-slate-400 mt-1">Se incluira en el XML de TicketBAI como descripcion de la factura</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de operacion</label>
              <select
                value={ticketbaiTipoOperacion}
                onChange={(e) => setTicketbaiTipoOperacion(e.target.value)}
                className="input-field"
              >
                <option value="prestacion_servicios">Prestacion de servicios</option>
                <option value="entrega_bienes">Entrega de bienes</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50/50 transition-colors w-full">
                <input
                  type="checkbox"
                  checked={autoGenerateTbai}
                  onChange={(e) => setAutoGenerateTbai(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">Generar automaticamente</span>
                  <p className="text-xs text-slate-400">Emitir TicketBAI al crear la factura</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? "Creando..." : "Crear factura"}
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
