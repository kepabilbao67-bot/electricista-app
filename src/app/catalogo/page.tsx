"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Package, Search, Save, TrendingUp } from "lucide-react";
import { showToast } from "@/components/Toast";

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  cost_price: number;
  category: string | null;
}

export default function CatalogoPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    unit_price: 0,
    cost_price: 0,
    category: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchItems = () => {
    fetch("/api/catalog").then((r) => r.json()).then((data) => {
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));

  const filtered = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || item.category === filterCategory;
    return matchSearch && matchCategory;
  });

  // Group by category
  const grouped = filtered.reduce((acc, item) => {
    const cat = item.category || "Sin categoria";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, CatalogItem[]>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    if (editingId) {
      // Update
      const res = await fetch("/api/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: editingId }),
      });
      if (res.ok) {
        showToast("success", "Item actualizado");
        setShowForm(false);
        setEditingId(null);
        setForm({ name: "", description: "", unit_price: 0, cost_price: 0, category: "" });
        fetchItems();
      }
    } else {
      // Create
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        showToast("success", "Item creado");
        setShowForm(false);
        setForm({ name: "", description: "", unit_price: 0, cost_price: 0, category: "" });
        fetchItems();
      }
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("¿Eliminar este item del catalogo?")) return;
    await fetch(`/api/catalog`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: "_DELETE_" }),
    });
    setItems(items.filter((i) => i.id !== id));
    showToast("success", "Item eliminado");
  };

  const editItem = (item: CatalogItem) => {
    setForm({
      name: item.name,
      description: item.description || "",
      unit_price: item.unit_price,
      cost_price: item.cost_price || 0,
      category: item.category || "",
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const totalMargen = items.reduce((acc, item) => acc + (item.unit_price - (item.cost_price || 0)), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catalogo de materiales</h1>
          <p className="text-sm text-slate-500">{items.length} items - Precio compra, venta y margen</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: "", description: "", unit_price: 0, cost_price: 0, category: "" }); }} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-all">
          <Plus className="h-4 w-4" />
          Anadir item
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-6 border-indigo-200 bg-indigo-50/30">
          <h2 className="text-base font-semibold text-slate-900 mb-4">{editingId ? "Editar item" : "Nuevo item"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Nombre *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Magnetotermico 2x16" className="input-field" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Descripcion</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalles opcionales..." className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Precio COMPRA (lo que te cuesta)</label>
              <input type="number" min="0" step="0.01" value={form.cost_price || ""} onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })} placeholder="0.00" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Precio VENTA (lo que cobras)</label>
              <input type="number" min="0" step="0.01" required value={form.unit_price || ""} onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} placeholder="0.00" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Categoria</label>
              <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Proteccion, Mecanismos, Lineas..." className="input-field" list="categories" />
              <datalist id="categories">
                {categories.map((c) => <option key={c} value={c || ""} />)}
              </datalist>
            </div>
            <div className="flex items-end">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 w-full text-center">
                <p className="text-xs text-emerald-600">Margen</p>
                <p className="text-lg font-bold text-emerald-700">
                  {form.cost_price > 0 ? `${((form.unit_price - form.cost_price) / form.cost_price * 100).toFixed(0)}%` : "-"}
                  {form.cost_price > 0 && <span className="text-sm font-normal ml-2">({(form.unit_price - form.cost_price).toFixed(2)}€)</span>}
                </p>
              </div>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary"><Save className="h-4 w-4" /> {editingId ? "Guardar" : "Crear"}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Search and filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field !pl-10" />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input-field w-auto">
          <option value="">Todas</option>
          {categories.map((c) => <option key={c} value={c || ""}>{c}</option>)}
        </select>
      </div>

      {/* Items grouped by category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No hay items en el catalogo</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categoryItems]) => (
            <div key={category}>
              <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {category}
                <span className="text-xs font-normal text-slate-400">({categoryItems.length})</span>
              </h3>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Material</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500 w-24">Compra</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500 w-24">Venta</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500 w-20">Margen</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500 w-20">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categoryItems.map((item) => {
                      const margin = item.cost_price > 0 ? ((item.unit_price - item.cost_price) / item.cost_price * 100) : 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-slate-900">{item.name}</p>
                            {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-red-600 font-medium">
                            {item.cost_price ? `${item.cost_price.toFixed(2)}€` : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-emerald-700 font-bold">{item.unit_price.toFixed(2)}€</td>
                          <td className="px-4 py-2.5 text-right">
                            {item.cost_price > 0 ? (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${margin > 50 ? "bg-emerald-100 text-emerald-700" : margin > 20 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                {margin.toFixed(0)}%
                              </span>
                            ) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => editItem(item)} className="rounded p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600" title="Editar">
                                <Save className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => deleteItem(item.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
