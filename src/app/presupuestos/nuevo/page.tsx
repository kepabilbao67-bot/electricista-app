"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronRight, Copy, Wand2, X } from "lucide-react";
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

interface Zone {
  name: string;
  items: BudgetItem[];
  collapsed: boolean;
}

const PREDEFINED_ZONES = [
  "Cuadro electrico",
  "Cocina",
  "Salon",
  "Habitacion 1",
  "Habitacion 2",
  "Habitacion 3",
  "Habitacion 4",
  "Bano principal",
  "Bano secundario",
  "Entrada/Pasillo",
  "Terraza/Txoko",
  "Instalacion general",
];

export default function NuevoPresupuestoPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const [zones, setZones] = useState<Zone[]>([
    { name: "Instalacion general", items: [{ description: "", quantity: 1, unit_price: 0 }], collapsed: false },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [customZoneName, setCustomZoneName] = useState("");
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoType, setAutoType] = useState<"piso" | "chalet" | "local">("piso");
  const [autoRooms, setAutoRooms] = useState(2);
  const [autoBathrooms, setAutoBathrooms] = useState(1);
  const [autoKitchen, setAutoKitchen] = useState(true);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then(setClients);
    fetch("/api/catalog").then((r) => r.json()).then(setCatalog);
  }, []);

  const generateAutoBudget = () => {
    const newZones: Zone[] = [];

    // Calcular circuitos totales según REBT
    // C1: alumbrado (1 por cada 30 puntos de luz)
    // C2: enchufes generales
    // C3: cocina/horno
    // C4: lavadora/lavavajillas/termo
    // C5: enchufes baño/cocina
    // + adicionales por habitaciones
    const circuitosAlumbrado = Math.ceil((autoRooms * 6 + autoBathrooms * 4 + 8 + 4 + (autoKitchen ? 3 : 0)) / 30) + 1;
    const circuitosEnchufe = Math.ceil(autoRooms / 2) + 1;
    const circuitosCocina = autoKitchen ? 1 : 0;
    const circuitosElectrodomesticos = autoKitchen ? 4 : 1; // lavadora, lavavajillas, microondas, frigo
    const circuitosHumedos = 1;
    const totalCircuits = circuitosAlumbrado + circuitosEnchufe + circuitosCocina + circuitosElectrodomesticos + circuitosHumedos;
    const numDiferenciales = Math.ceil(totalCircuits / 5);
    const numMagnetos2x16 = circuitosEnchufe + circuitosElectrodomesticos + circuitosHumedos;
    const numMagnetos2x10 = circuitosAlumbrado;

    // CUADRO ELECTRICO
    const cuadroItems: BudgetItem[] = [
      { description: "Cambiar derivacion individual de la vivienda desde el cuadro electrico al modulo de contadores", quantity: 1, unit_price: 475 },
      { description: "Suministro y colocado de cuadro electrico de empotrar con puerta", quantity: 1, unit_price: 225 },
      { description: "Suministro y colocado de sobre tensiones", quantity: 1, unit_price: 110.90 },
      { description: "Suministro y colocado de magnetotermico general de la vivienda", quantity: 1, unit_price: 57.60 },
      { description: "Suministro y colocado de diferenciales", quantity: numDiferenciales, unit_price: 45.50 },
      { description: "Suministro y colocado de magnetotermico para vitro/horno", quantity: autoKitchen ? 1 : 0, unit_price: 59.60 },
      { description: "Suministro y colocado de magnetotermicos de 2x16", quantity: numMagnetos2x16, unit_price: 47.50 },
      { description: "Suministro y colocado de magnetotermico de 2x10", quantity: numMagnetos2x10, unit_price: 45.50 },
      { description: "Suministro y colocado de timbre de carril", quantity: 1, unit_price: 97 },
      { description: "Suministro y colocado de peines para cuadro electrico", quantity: 1, unit_price: 125 },
      { description: "Rotulacion de cuadro electrico y esquema unifilar", quantity: 1, unit_price: 55 },
    ].filter(item => item.quantity > 0);
    newZones.push({ name: "Cuadro electrico", items: cuadroItems, collapsed: false });

    // LINEAS (Instalacion general de cables)
    const lineasItems: BudgetItem[] = [
      { description: "Suministro y colocado de linea de alumbrado de toda la casa", quantity: circuitosAlumbrado, unit_price: 68.50 },
      { description: "Suministro y colocado de linea de enchufes normales", quantity: circuitosEnchufe, unit_price: 75.50 },
      { description: "Suministro y colocado de enchufes humedos", quantity: 1, unit_price: 75.50 },
      { description: "Suministro y colocado de linea para caldera", quantity: 1, unit_price: 75.50 },
      { description: "Suministro y colocado de linea para lavadora", quantity: 1, unit_price: 75.50 },
    ];
    if (autoKitchen) {
      lineasItems.push(
        { description: "Suministro y colocado de linea para lavavajillas", quantity: 1, unit_price: 75.50 },
        { description: "Suministro y colocado de linea para microondas", quantity: 1, unit_price: 75.50 },
        { description: "Suministro y colocado de linea para frigorifico", quantity: 1, unit_price: 75.50 },
        { description: "Suministro y colocado de linea horno-vitro", quantity: 1, unit_price: 102.50 },
        { description: "Suministro y colocado de linea de campana", quantity: 1, unit_price: 68.50 },
      );
    }
    lineasItems.push({ description: "Suministro y colocado de linea de rack", quantity: 1, unit_price: 75.50 });
    newZones.push({ name: "Lineas", items: lineasItems, collapsed: false });

    // HABITACIONES
    for (let i = 1; i <= autoRooms; i++) {
      const roomItems: BudgetItem[] = [
        { description: "Enchufes en la habitacion", quantity: 5, unit_price: 67.50 },
        { description: "Conmutadores en la habitacion", quantity: 3, unit_price: 57.50 },
        { description: "Interruptores habitacion", quantity: 2, unit_price: 57.60 },
        { description: "Toma de TV habitacion", quantity: 1, unit_price: 85.60 },
        { description: "Toma de RJ45 habitacion", quantity: 1, unit_price: 85.65 },
        { description: "Focos en habitacion", quantity: 6, unit_price: 67.50 },
      ];
      newZones.push({ name: `Habitacion ${i}`, items: roomItems, collapsed: false });
    }

    // COCINA
    if (autoKitchen) {
      const kitchenItems: BudgetItem[] = [
        { description: "Enchufes en encimera de cocina", quantity: 4, unit_price: 67.50 },
        { description: "Interruptores en cocina", quantity: 1, unit_price: 57.60 },
        { description: "Focos en cocina", quantity: 3, unit_price: 67.50 },
      ];
      newZones.push({ name: "Cocina", items: kitchenItems, collapsed: false });
    }

    // SALON
    const salonItems: BudgetItem[] = [
      { description: "Enchufes en el salon", quantity: 6, unit_price: 67.50 },
      { description: "Tomas TV salon", quantity: 1, unit_price: 85.60 },
      { description: "Toma de RJ45 en el salon", quantity: 2, unit_price: 85.65 },
      { description: "Conmutadores en el salon", quantity: 4, unit_price: 57.50 },
      { description: "Interruptores en el salon", quantity: 2, unit_price: 57.60 },
      { description: "Focos en el salon", quantity: 8, unit_price: 67.50 },
    ];
    newZones.push({ name: "Salon", items: salonItems, collapsed: false });

    // BAÑOS
    for (let i = 1; i <= autoBathrooms; i++) {
      const bathroomItems: BudgetItem[] = [
        { description: `Enchufes de WC`, quantity: 2, unit_price: 67.50 },
        { description: `Interruptores en WC`, quantity: 2, unit_price: 57.60 },
        { description: `Focos WC`, quantity: 4, unit_price: 67.50 },
      ];
      const name = autoBathrooms === 1 ? "WC" : (i === 1 ? "WC principal" : "WC secundario");
      newZones.push({ name, items: bathroomItems, collapsed: false });
    }

    // ENTRADA / PASILLO
    const entradaItems: BudgetItem[] = [
      { description: "Conmutadores en la entrada", quantity: 3, unit_price: 57.50 },
      { description: "Enchufes en la entrada", quantity: 3, unit_price: 67.50 },
      { description: "Focos en la entrada", quantity: 4, unit_price: 67.50 },
    ];
    newZones.push({ name: "Entrada/Pasillo", items: entradaItems, collapsed: false });

    // INSTALACION GENERAL (obra civil + telecomunicaciones)
    const generalItems: BudgetItem[] = [
      { description: "Cuadro de telecomunicaciones en el salon", quantity: 1, unit_price: 140 },
      { description: "Switch", quantity: 1, unit_price: 155 },
      { description: "Picado de rozas", quantity: 1, unit_price: 780 },
      { description: "Cajas de mecanismos universales, de derivaciones, pequeño material electrico", quantity: 1, unit_price: 485 },
    ];
    newZones.push({ name: "Instalacion general", items: generalItems, collapsed: false });

    setZones(newZones);
    setShowAutoModal(false);
    showToast("success", "Presupuesto generado automaticamente");
  };

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
    if (zones.length <= 1) {
      showToast("error", "Debe haber al menos una estancia");
      return;
    }
    setZones(zones.filter((_, i) => i !== zoneIndex));
  };

  const duplicateZone = (zoneIndex: number) => {
    const sourceZone = zones[zoneIndex];
    let newName = sourceZone.name;
    // Generate a unique name
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
    const duplicated: Zone = {
      name: newName,
      items: sourceZone.items.map((item) => ({ ...item })),
      collapsed: false,
    };
    const newZones = [...zones];
    newZones.splice(zoneIndex + 1, 0, duplicated);
    setZones(newZones);
    showToast("success", `Estancia duplicada como "${newName}"`);
  };

  const toggleZoneCollapse = (zoneIndex: number) => {
    const newZones = [...zones];
    newZones[zoneIndex] = { ...newZones[zoneIndex], collapsed: !newZones[zoneIndex].collapsed };
    setZones(newZones);
  };

  const addItem = (zoneIndex: number) => {
    const newZones = [...zones];
    newZones[zoneIndex] = {
      ...newZones[zoneIndex],
      items: [...newZones[zoneIndex].items, { description: "", quantity: 1, unit_price: 0 }],
    };
    setZones(newZones);
  };

  const removeItem = (zoneIndex: number, itemIndex: number) => {
    const newZones = [...zones];
    newZones[zoneIndex] = {
      ...newZones[zoneIndex],
      items: newZones[zoneIndex].items.filter((_, i) => i !== itemIndex),
    };
    setZones(newZones);
  };

  const updateItem = (zoneIndex: number, itemIndex: number, field: keyof BudgetItem, value: string | number) => {
    const newZones = [...zones];
    const newItems = [...newZones[zoneIndex].items];
    newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
    newZones[zoneIndex] = { ...newZones[zoneIndex], items: newItems };
    setZones(newZones);
  };

  const addFromCatalog = (zoneIndex: number, catalogItem: CatalogItem) => {
    const newZones = [...zones];
    const zoneItems = [...newZones[zoneIndex].items];

    // If an item with same name and price already exists, increment quantity
    const existingIndex = zoneItems.findIndex(
      (item) => item.description === catalogItem.name && item.unit_price === catalogItem.unit_price
    );

    if (existingIndex >= 0) {
      zoneItems[existingIndex] = {
        ...zoneItems[existingIndex],
        quantity: zoneItems[existingIndex].quantity + 1,
      };
    } else {
      // If last item is empty, replace it
      const lastItem = zoneItems[zoneItems.length - 1];
      if (lastItem && !lastItem.description && lastItem.unit_price === 0) {
        zoneItems[zoneItems.length - 1] = {
          description: catalogItem.name,
          quantity: 1,
          unit_price: catalogItem.unit_price,
        };
      } else {
        zoneItems.push({
          description: catalogItem.name,
          quantity: 1,
          unit_price: catalogItem.unit_price,
        });
      }
    }

    newZones[zoneIndex] = { ...newZones[zoneIndex], items: zoneItems };
    setZones(newZones);
  };

  const getZoneSubtotal = (zone: Zone) => {
    return zone.items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  };

  const subtotal = zones.reduce((acc, zone) => acc + getZoneSubtotal(zone), 0);
  const taxAmount = subtotal * 0.21;
  const total = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Flatten all zone items with [ZONA] prefix
    const allItems = zones.flatMap((zone) =>
      zone.items
        .filter((item) => item.description && item.unit_price > 0)
        .map((item) => ({
          description: `[${zone.name}] ${item.description}`,
          quantity: item.quantity,
          unit_price: item.unit_price,
        }))
    );

    if (allItems.length === 0) {
      showToast("error", "Agrega al menos un item con descripcion y precio");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId || null,
        date,
        valid_until: validUntil || null,
        notes,
        tax_rate: 21,
        items: allItems,
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

  const availableZones = PREDEFINED_ZONES.filter(
    (z) => !zones.find((existing) => existing.name === z)
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="page-title mb-6">Nuevo presupuesto</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Datos generales</h2>
            <button
              type="button"
              onClick={() => setShowAutoModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
            >
              <Wand2 className="h-4 w-4" /> Generar presupuesto automatico
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cliente</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="input-field"
              >
                <option value="">Sin cliente (asignar despues)</option>
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

        {/* Zones */}
        {zones.map((zone, zoneIndex) => (
          <div key={zoneIndex} className="card">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleZoneCollapse(zoneIndex)}
            >
              <div className="flex items-center gap-2">
                {zone.collapsed ? (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
                <h2 className="text-base font-semibold text-slate-900">{zone.name}</h2>
                <span className="text-sm text-slate-500 ml-2">
                  ({zone.items.filter((i) => i.description).length} items)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-600">
                  {getZoneSubtotal(zone).toFixed(2)} EUR
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); duplicateZone(zoneIndex); }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  title="Duplicar estancia"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeZone(zoneIndex); }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Eliminar estancia"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!zone.collapsed && (
              <div className="mt-4">
                {/* Catalog for this zone */}
                {catalog.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-slate-500 mb-2">Agregar desde catalogo:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {catalog.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addFromCatalog(zoneIndex, item)}
                          className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                        >
                          {item.name} ({item.unit_price} EUR)
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items */}
                <div className="space-y-3">
                  {zone.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Descripcion"
                          value={item.description}
                          onChange={(e) => updateItem(zoneIndex, itemIndex, "description", e.target.value)}
                          className="input-field"
                        />
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Cant."
                          value={item.quantity}
                          onChange={(e) => updateItem(zoneIndex, itemIndex, "quantity", parseInt(e.target.value) || 1)}
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
                          onChange={(e) => updateItem(zoneIndex, itemIndex, "unit_price", parseFloat(e.target.value) || 0)}
                          className="input-field"
                        />
                      </div>
                      <div className="w-24 text-right py-2 text-sm font-medium text-slate-700">
                        {(item.quantity * item.unit_price).toFixed(2)} EUR
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(zoneIndex, itemIndex)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => addItem(zoneIndex)}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Linea
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add Zone */}
        <div className="card">
          {!showAddZone ? (
            <button
              type="button"
              onClick={() => setShowAddZone(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <Plus className="h-4 w-4" /> Agregar estancia
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Seleccionar estancia predefinida:</p>
              <div className="flex flex-wrap gap-2">
                {availableZones.map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => addZone(z)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    {z}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center mt-2">
                <input
                  type="text"
                  placeholder="O nombre personalizado..."
                  value={customZoneName}
                  onChange={(e) => setCustomZoneName(e.target.value)}
                  className="input-field flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addZone(customZoneName);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => addZone(customZoneName)}
                  className="btn-primary text-sm"
                >
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddZone(false); setCustomZoneName(""); }}
                  className="btn-secondary text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="card">
          <div className="text-right space-y-1">
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

      {/* Auto Budget Modal */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-amber-600" />
                <h3 className="text-lg font-bold text-slate-900">Presupuesto automatico</h3>
              </div>
              <button
                onClick={() => setShowAutoModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-5">
              Genera automaticamente todas las estancias con materiales y precios segun el tipo de vivienda.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de vivienda</label>
                <select
                  value={autoType}
                  onChange={(e) => setAutoType(e.target.value as "piso" | "chalet" | "local")}
                  className="input-field"
                >
                  <option value="piso">Piso</option>
                  <option value="chalet">Chalet</option>
                  <option value="local">Local comercial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Numero de habitaciones: {autoRooms}
                </label>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={autoRooms}
                  onChange={(e) => setAutoRooms(parseInt(e.target.value))}
                  className="w-full accent-blue-700"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Numero de banos: {autoBathrooms}
                </label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  value={autoBathrooms}
                  onChange={(e) => setAutoBathrooms(parseInt(e.target.value))}
                  className="w-full accent-blue-700"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>1</span><span>2</span><span>3</span>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoKitchen}
                    onChange={(e) => setAutoKitchen(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-700">Cocina independiente</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={generateAutoBudget}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Wand2 className="h-4 w-4" /> Generar
              </button>
              <button
                type="button"
                onClick={() => setShowAutoModal(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
