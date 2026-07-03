"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Edit2, Trash2, Phone, Mail, MessageCircle, FileText, Users, Eye, Upload } from "lucide-react";
import { showToast } from "@/components/Toast";

interface Client {
  id: string;
  name: string;
  nif: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  province: string;
  notes: string;
  client_type: string;
  invoice_count?: number;
}

export default function ClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    nif: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postal_code: "",
    province: "",
    notes: "",
    client_type: "particular",
  });

  const fetchClients = () => {
    const url = search ? `/api/clients?search=${encodeURIComponent(search)}` : "/api/clients";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setClients(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchClients();
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingClient ? `/api/clients/${editingClient.id}` : "/api/clients";
    const method = editingClient ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      showToast("success", editingClient ? "Cliente actualizado correctamente" : "Cliente creado correctamente");
      setShowForm(false);
      setEditingClient(null);
      setForm({ name: "", nif: "", email: "", phone: "", address: "", city: "", postal_code: "", province: "", notes: "", client_type: "particular" });
      fetchClients();
    } else {
      showToast("error", "Error al guardar el cliente");
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name || "",
      nif: client.nif || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      city: client.city || "",
      postal_code: client.postal_code || "",
      province: client.province || "",
      notes: client.notes || "",
      client_type: client.client_type || "particular",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Seguro que desea eliminar este cliente? Esta accion no se puede deshacer.")) {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Cliente eliminado");
        fetchClients();
      } else {
        showToast("error", "Error al eliminar el cliente");
      }
    }
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    let cleaned = phone.replace(/[\s\-\(\)]/g, "");
    if (cleaned.startsWith("6") || cleaned.startsWith("7") || cleaned.startsWith("9")) {
      cleaned = "34" + cleaned;
    } else if (cleaned.startsWith("+")) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-800 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clients.length} clientes registrados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/clientes/importar")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Upload className="h-4 w-4" />
            Importar
          </button>
          <button
            onClick={() => {
              setEditingClient(null);
              setForm({ name: "", nif: "", email: "", phone: "", address: "", city: "", postal_code: "", province: "", notes: "", client_type: "particular" });
              setShowForm(true);
            }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, NIF, email o telefono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {showForm && (
        <div className="mb-6 card-static animate-scale-in">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            {editingClient ? "Editar cliente" : "Nuevo cliente"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo</label>
              <select value={form.client_type} onChange={(e) => setForm({ ...form, client_type: e.target.value })} className="input-field">
                <option value="particular">Particular</option>
                <option value="empresa">Empresa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">NIF</label>
              <input type="text" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefono</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Direccion</label>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Ciudad</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Codigo postal</label>
              <input type="text" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Provincia</label>
              <input type="text" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas rapidas</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="input-field" placeholder="Ej: llaves del portal en porteria" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary">
                {editingClient ? "Guardar cambios" : "Crear cliente"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Telefono</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Email</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Facturas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="table-row">
                  <td className="px-4 py-3.5">
                    <div>
                      <Link href={`/clientes/${client.id}`} className="font-semibold text-slate-900 hover:text-blue-800 transition-colors">
                        {client.name}
                      </Link>
                      {client.city && <p className="text-xs text-slate-400">{client.city}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className={`badge text-[10px] ${client.client_type === "empresa" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                      {client.client_type === "empresa" ? "Empresa" : "Particular"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    {client.phone ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">{client.phone}</span>
                        <a href={`tel:${client.phone}`} className="rounded-md p-1 text-blue-500 hover:bg-blue-50 transition-colors" title="Llamar">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        <a href={`https://wa.me/${formatPhoneForWhatsApp(client.phone)}`} target="_blank" rel="noopener noreferrer" className="rounded-md p-1 text-emerald-500 hover:bg-emerald-50 transition-colors" title="WhatsApp">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    {client.email ? (
                      <a href={`mailto:${client.email}`} className="text-xs text-blue-700 hover:underline">{client.email}</a>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center hidden md:table-cell">
                    {client.invoice_count !== undefined && client.invoice_count > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100">
                        <FileText className="h-3 w-3" />
                        {client.invoice_count}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/clientes/${client.id}`} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition-colors" title="Ver detalle">
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button onClick={() => handleEdit(client)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition-colors" title="Editar">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(client.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="empty-state">
                      <Users className="empty-state-icon" />
                      <p className="empty-state-title">Sin clientes</p>
                      <p className="empty-state-text">Agrega tu primer cliente para empezar</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
