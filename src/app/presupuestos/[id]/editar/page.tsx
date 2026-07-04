"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronRight, Copy, ArrowLeft, Save } from "lucide-react";
import { showToast } from "@/components/Toast";

interface Client { id: string; name: string; }
interface CatalogItem { id: string; name: string; unit_price: number; category: string; }
interface BudgetItem { description: string; quantity: number; unit_price: number; }
interface Zone { name: string; items: BudgetItem[]; collapsed: boolean; }

const PREDEFINED_ZONES = [
  "Cuadro electrico", "Cocina", "Salon", "Habitacion 1", "Habitacion 2",
  "Habitacion 3", "Habitacion 4", "Bano principal", "Bano secundario",
  "Entrada/Pasillo", "Terraza/Txoko", "Instalacion general",
];

export default function EditarPresupuestoPage() {
  const params = useParams();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [customZoneName, setCustomZoneName] = useState("");
  const [budgetNumber, setBudgetNumber] = useState("");

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then(setClients);
    fetch("/api/catalog").then((r) => r.json()).then(setCatalog);

    if (params.id) {
      fetch(`/api/budgets/${params.id}`)
        .then((r) => r.json())
        .then((data) => {
          setClientId(data.client_id);
          setDate(data.date);
          setValidUntil(data.valid_until || "");
          setNotes(data.notes || "");
          setBudgetNumber(data.number);

          // Parse items into zones
          const zoneMap = new Map<string, BudgetItem[]>();
          for (const item of data.items) {
            const match = item.description.match(/^\[([^\]]+)\]\s*(.*)$/);
            const zoneName = match ? match[1] : "General";
            const desc = match ? match[2] : item.description;
            if (!zoneMap.has(zoneName)) zoneMap.set(zoneName, []);
            zoneMap.get(zoneName)!.push({ description: desc, quantity: item.quantity, unit_price: item.unit_price });
          }

          if (zoneMap.size === 0) {
            setZones([{ name: "General", items: [{ description: "", quantity: 1, unit_price: 0 }], collapsed: false }]);
          } else {
            setZones(Array.from(zoneMap.entries()).map(([name, items]) => ({ name, items, collapsed: false })));
          }

          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [params.id]);

  const addZone = (zoneName: string) => {
    if (!zoneName.trim()) return;
    if (zones.find((z) => z.name === zoneName.trim())) {
      showToast("error", "Esa estancia ya existe");
      return;
    }
    setZones([...zones, { name: zoneName.trim(), items: [{ description: "", quantity: 1, unit_price: 0 }], collapsed: false }]);
    setShowAddZone(false);
    setCustomZoneName("");
  };

  const removeZone = (zoneIndex: number) => {
    if (zones.length <= 1) { showToast("error", "Debe haber al menos una estancia"); return; }
    setZones(zones.filter((_, i) => i !== zoneIndex));
  };

  const duplicateZone = (zoneIndex: number) => {
    const sourceZone = zones[zoneIndex];
    let newName = sourceZone.name;
    const match = newName.match(/^(.*?)(\d+)$/);
    if (match) {
      let num = parseInt(match[2]) + 1;
      while (zones.find((z) => z.name === `${match[1]}${num}`)) num++;
      newName = `${match[1]}${num}`;
    } else {
      let suffix = 2;
      while (zones.find((z) => z.name === `${newName} ${suffix}`)) suffix++;
      newName = `${newName} ${suffix}`;
    }
    const newZone: Zone = { name: newName, items: sourceZone.items.map((i) => ({ ...i })), collapsed: false };
    setZones([...zones, newZone]);
    showToast("success", `Estancia "${newName}" duplicada`);
  };

  const toggleZone = (zoneIndex: number) => {
    const newZones = [...zones];
    newZones[zoneIndex] = { ...newZones[zoneIndex], collapsed: !newZones[zoneIndex].collapsed };
    setZones(newZones);
  };

  const addItemToZone = (zoneIndex: number) => {
    const newZones = [...zones];
    newZones[zoneIndex].items.push({ description: "", quantity: 1, unit_price: 0 });
    setZones(newZones);
  };

  const removeItemFromZone = (zoneIndex: number, itemIndex: number) => {
    const newZones = [...zones];
    newZones[zoneIndex].items = newZones[zoneIndex].items.filter((_, i) => i !== itemIndex);
    if (newZones[zoneIndex].items.length === 0) {
      newZones[zoneIndex].items = [{ description: "", quantity: 1, unit_price: 0 }];
    }
    setZones(newZones);
  };

  const updateItemInZone = (zoneIndex: number, itemIndex: number, field: keyof BudgetItem, value: string | number) => {
    const newZones = [...zones];
    newZones[zoneIndex].items[itemIndex] = { ...newZones[zoneIndex].items[itemIndex], [field]: value };
    setZones(newZones);
  };

  const addFromCatalog = (zoneIndex: number, catalogItem: CatalogItem) => {
    const newZones = [...zones];
    const existingIndex = newZones[zoneIndex].items.findIndex(
      (item) => item.description === catalogItem.name && item.unit_price === catalogItem.unit_price
    );
    if (existingIndex >= 0) {
      newZones[zoneIndex].items[existingIndex].quantity += 1;
    } else {
      const lastItem = newZones[zoneIndex].items[newZones[zoneIndex].items.length - 1];
      if (lastItem && !lastItem.description && lastItem.unit_price === 0) {
        newZones[zoneIndex].items[newZones[zoneIndex].items.length - 1] = { description: catalogItem.name, quantity: 1, unit_price: catalogItem.unit_price };
      } else {
        newZones[zoneIndex].items.push({ description: catalogItem.name, quantity: 1, unit_price: catalogItem.unit_price });
      }
    }
    setZones(newZones);
  };

  const getZoneSubtotal = (zone: Zone) => zone.items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  const subtotal = zones.reduce((acc, zone) => acc + getZoneSubtotal(zone), 0);
  const taxAmount = subtotal * 0.21;
  const total = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    setSubmitting(true);

    const allItems = zones.flatMap((zone) =>
      zone.items
        .filter((i) => i.description && i.unit_price > 0)
        .map((i) => ({
          description: zones.length > 1 || zone.name !== "General" ? `[${zone.name}] ${i.description}` : i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }))
    );

    const res = await fetch(`/api/budgets/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        date,
        valid_until: validUntil || null,
        notes,
        tax_rate: 21,
        items: allItems,
      }),
    });

    if (res.ok) {
      showToast("success", "Presupuesto actualizado correctamente");
      router.push(`/presupuestos/${params.id}`);
    } else {
      showToast("error", "Error al actualizar el presupuesto");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editar presupuesto {budgetNumber}</h1>
          <p className="text-sm text-slate-500">Modifica los datos y lineas del presupuesto</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos generales */}
        <div className="card">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Datos generales</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cliente *</label>
              <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className="input-field">
                <option value="">Seleccionar</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Valido hasta</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="input-field" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripcion / Notas</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input-field" />
            </div>
          </div>
        </div>

        {/* Estancias */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Estancias / Zonas</h2>
            <button type="button" onClick={() => setShowAddZone(!showAddZone)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors">
              <Plus className="h-3 w-3" /> Estancia
            </button>
          </div>

          {showAddZone && (
            <div className="card border-indigo-200 bg-indigo-50/50">
              <p className="text-sm font-medium text-slate-700 mb-2">Añadir estancia:</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {PREDEFINED_ZONES.filter((z) => !zones.find((ez) => ez.name === z)).map((z) => (
                  <button key={z} type="button" onClick={() => addZone(z)} className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100 transition-colors">
                    {z}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Nombre personalizado..." value={customZoneName} onChange={(e) => setCustomZoneName(e.target.value)} className="input-field flex-1" />
                <button type="button" onClick={() => addZone(customZoneName)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700">Añadir</button>
              </div>
            </div>
          )}

          {zones.map((zone, zoneIndex) => (
            <div key={zoneIndex} className="card border-slate-200">
              {/* Zone header */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <button type="button" onClick={() => toggleZone(zoneIndex)} className="text-slate-400 hover:text-slate-600">
                  {zone.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <h3 className="font-semibold text-slate-900 flex-1">{zone.name}</h3>
                <span className="text-sm font-medium text-indigo-600">{getZoneSubtotal(zone).toFixed(2)} EUR</span>
                <button type="button" onClick={() => duplicateZone(zoneIndex)} className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Duplicar estancia">
                  <Copy className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => removeZone(zoneIndex)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar estancia">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {!zone.collapsed && (
                <>
                  {/* Catalog buttons */}
                  {catalog.length > 0 && (
                    <div className="mb-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex flex-wrap gap-1.5">
                        {catalog.map((item) => (
                          <button key={item.id} type="button" onClick={() => addFromCatalog(zoneIndex, item)} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all">
                            {item.name} ({item.unit_price}€)
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Items */}
                  <div className="space-y-2">
                    {zone.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex gap-2 items-center">
                        <input type="text" placeholder="Descripcion" value={item.description} onChange={(e) => updateItemInZone(zoneIndex, itemIndex, "description", e.target.value)} className="input-field flex-1 !py-1.5 text-sm" />
                        <input type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateItemInZone(zoneIndex, itemIndex, "quantity", parseFloat(e.target.value) || 0)} className="input-field w-16 !py-1.5 text-sm text-center" />
                        <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItemInZone(zoneIndex, itemIndex, "unit_price", parseFloat(e.target.value) || 0)} className="input-field w-20 !py-1.5 text-sm text-center" />
                        <span className="text-xs font-medium text-slate-600 w-20 text-right">{(item.quantity * item.unit_price).toFixed(2)}€</span>
                        <button type="button" onClick={() => removeItemFromZone(zoneIndex, itemIndex)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button type="button" onClick={() => addItemToZone(zoneIndex)} className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    <Plus className="h-3 w-3" /> Añadir linea
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Totales */}
        <div className="card bg-slate-50">
          <div className="text-right space-y-1">
            <p className="text-sm text-slate-500">Base imponible: <span className="font-medium text-slate-700">{subtotal.toFixed(2)} EUR</span></p>
            <p className="text-sm text-slate-500">IVA 21%: <span className="font-medium text-slate-700">{taxAmount.toFixed(2)} EUR</span></p>
            <p className="text-xl font-bold text-slate-900">Total: {total.toFixed(2)} EUR</p>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-all disabled:opacity-50">
            <Save className="h-4 w-4" />
            {submitting ? "Guardando..." : "Guardar cambios"}
          </button>
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
