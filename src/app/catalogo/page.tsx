"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Package, Search, Tag } from "lucide-react";
import { showToast } from "@/components/Toast";

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  category: string | null;
  created_at: string;
}

export default function CatalogoPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    unit_price: 0,
    category: "",
  });

  const fetchItems = () => {
    fetch("/api/catalog")
      .then((res) => res.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingItem ? `/api/catalog/${editingItem.id}` : "/api/catalog";
    const method = editingItem ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      showToast("success", editingItem ? "Item actualizado" : "Item creado correctamente");
      setShowForm(false);
      setEditingItem(null);
      setForm({ name: "", description: "", unit_price: 0, category: "" });
      fetchItems();
    } else {
      showToast("error", "Error al guardar el item");
    }
  };

  const handleEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setForm({
      name: item.name || "",
      description: item.description || "",
      unit_price: item.unit_price || 0,
      category: item.category || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Seguro que desea eliminar este item del catalogo?")) {
      const res = await fetch(`/api/catalog/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Item eliminado del catalogo");
        fetchItems();
      } else {
        showToast("error", "Error al eliminar el item");
      }
    }
  };

  // Get unique categories
  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[];

  // Filter items
  const filtered = items.filter((item) => {
    const matchesSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !filterCategory || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Catalogo</h1>
          <p className="page-subtitle">{items.length} materiales y servicios</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setForm({ name: "", description: "", unit_price: 0, category: "" });
            setShowForm(true);
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          Nuevo item
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o descripcion..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCategory("")}
            className={`rounded-lg px-3 py-2 text-xs font-medium border transition-all duration-200 ${
              !filterCategory
                ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`rounded-lg px-3 py-2 text-xs font-medium border transition-all duration-200 ${
                filterCategory === cat
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-6 card">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            {editingItem ? "Editar item" : "Nuevo item de catalogo"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Ej: Magnetotermico 2x16"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Precio unitario (EUR) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Categoria</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-field"
                placeholder="Ej: Proteccion, Instalacion, Material"
                list="categories-list"
              />
              <datalist id="categories-list">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripcion</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-field"
                placeholder="Descripcion opcional"
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary">
                {editingItem ? "Guardar cambios" : "Crear item"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <div key={item.id} className="card p-4 group">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                  <Package className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{item.name}</h3>
                  {item.category && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                      <Tag className="h-2.5 w-2.5" />
                      {item.category}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(item)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {item.description && (
              <p className="text-xs text-slate-500 mb-2 line-clamp-2">{item.description}</p>
            )}
            <p className="text-lg font-bold text-indigo-700">{item.unit_price.toFixed(2)} EUR</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full card p-12 text-center text-slate-400">
            {search || filterCategory ? "No hay items con estos filtros" : "No hay items en el catalogo"}
          </div>
        )}
      </div>
    </div>
  );
}
