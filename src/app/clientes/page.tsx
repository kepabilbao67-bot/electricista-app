"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Edit2, Trash2, Phone, Mail, FileText, Users, Eye, Upload, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { showToast } from "@/components/Toast";
import { autocorrectSpanishOnBoundary, autocorrectSpanishText } from "@/lib/autocorrect-es";
import TextAssistantButton from "@/components/TextAssistantButton";
import ColorSelect from "@/components/ColorSelect";
import { getTextColorClass } from "@/lib/text-colors";
import WhatsAppButton from "@/components/WhatsAppButton";

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
    address_color: "default",
    notes_color: "default",
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

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        showToast("success", editingClient ? "Cliente actualizado correctamente" : "Cliente creado correctamente");
        setShowForm(false);
        setEditingClient(null);
        setForm({ name: "", nif: "", email: "", phone: "", address: "", city: "", postal_code: "", province: "", notes: "", client_type: "particular", address_color: "default", notes_color: "default" });
        fetchClients();
      } else {
        showToast("error", "Error al guardar el cliente");
      }
    } catch {
      showToast("error", "Error de conexión. Comprueba tu red e inténtalo de nuevo.");
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
      address_color: (client as any).address_color || "default",
      notes_color: (client as any).notes_color || "default",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Seguro que desea eliminar este cliente? Esta acción no se puede deshacer.")) {
      try {
        const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("success", "Cliente eliminado");
          fetchClients();
        } else {
          const data = await res.json();
          showToast("error", data.error || "Error al eliminar el cliente");
        }
      } catch {
        showToast("error", "Error al eliminar el cliente");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-800 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">{clients.length} clientes registrados en tu cartera</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            icon={Upload}
            onClick={() => router.push("/clientes/importar")}
          >
            Importar
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => {
              setEditingClient(null);
              setForm({ name: "", nif: "", email: "", phone: "", address: "", city: "", postal_code: "", province: "", notes: "", client_type: "particular", address_color: "default", notes_color: "default" });
              setShowForm(true);
            }}
          >
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, NIF, email o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Form Card */}
      {showForm && (
        <Card variant="gradient" className="border border-blue-200 shadow-md">
          <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200/60">
            {editingClient ? "Editar Cliente" : "Nuevo Cliente"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Nombre completo *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Nombre o Razón Social" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Tipo de cliente</label>
              <select value={form.client_type} onChange={(e) => setForm({ ...form, client_type: e.target.value })} className="input-field">
                <option value="particular">Particular</option>
                <option value="empresa">Empresa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">NIF / CIF / NIE</label>
              <input type="text" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} className="input-field" placeholder="12345678Z" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Correo Electrónico</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="cliente@ejemplo.com" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Teléfono móvil / fijo</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+34 600 000 000" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Dirección de trabajo / fiscal</label>
                <ColorSelect value={form.address_color} onChange={(v) => setForm({ ...form, address_color: v })} />
              </div>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: autocorrectSpanishOnBoundary(e.target.value) })} onBlur={(e) => { const c = autocorrectSpanishText(e.target.value); if (c !== e.target.value) setForm((f) => ({ ...f, address: c })); }} className={`input-field ${getTextColorClass(form.address_color)}`} placeholder="Calle, número, piso" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Población / Ciudad</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field" placeholder="Bilbao" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Código Postal</label>
              <input type="text" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className="input-field" placeholder="48001" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Provincia</label>
              <input type="text" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className="input-field" placeholder="Bizkaia" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Notas de servicio</label>
                <ColorSelect value={form.notes_color} onChange={(v) => setForm({ ...form, notes_color: v })} />
              </div>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: autocorrectSpanishOnBoundary(e.target.value) })} onBlur={(e) => { const c = autocorrectSpanishText(e.target.value); if (c !== e.target.value) setForm((f) => ({ ...f, notes: c })); }} rows={2} className={`input-field ${getTextColorClass(form.notes_color)}`} placeholder="Ej: Llaves del portal en conserjería" />
              <div className="mt-1"><TextAssistantButton value={form.notes} onAccept={(t) => setForm({ ...form, notes: t })} /></div>
            </div>
            <div className="md:col-span-2 flex items-center gap-3 pt-2">
              <Button type="submit" variant="primary" size="md">
                {editingClient ? "Guardar Cambios" : "Crear Cliente"}
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Empty State */}
      {clients.length === 0 ? (
        <EmptyState
          title="Aún no tienes clientes"
          description="Añade tu primer cliente o importa tu lista para empezar a gestionar presupuestos, partes de trabajo y facturación."
          actionLabel="Crear Primer Cliente"
          onAction={() => {
            setEditingClient(null);
            setForm({ name: "", nif: "", email: "", phone: "", address: "", city: "", postal_code: "", province: "", notes: "", client_type: "particular", address_color: "default", notes_color: "default" });
            setShowForm(true);
          }}
        />
      ) : (
        /* Vista de Clientes con Cards / Tabla Estilizada */
        <div className="space-y-4">
          {/* Mobile Cards (Visible en pantallas pequeñas) */}
          <div className="grid grid-cols-1 md:hidden gap-3">
            {clients.map((client) => (
              <Card key={client.id} variant="default" className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/clientes/${client.id}`} className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors">
                      {client.name}
                    </Link>
                    {client.nif && <p className="text-xs text-slate-400 mt-0.5">{client.nif}</p>}
                  </div>
                  <Badge variant={client.client_type === "empresa" ? "green" : "blue"} size="sm">
                    {client.client_type === "empresa" ? "Empresa" : "Particular"}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-slate-600">
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <a href={`tel:${client.phone}`} className="hover:text-blue-600">{client.phone}</a>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <a href={`mailto:${client.email}`} className="truncate hover:text-blue-600">{client.email}</a>
                    </div>
                  )}
                  {client.city && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{client.city}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
                  {client.phone && <WhatsAppButton compact phone={client.phone} />}
                  <Link href={`/clientes/${client.id}`}>
                    <Button variant="ghost" size="sm" icon={Eye}>Ver</Button>
                  </Link>
                  <Button variant="ghost" size="sm" icon={Edit2} onClick={() => handleEdit(client)}>Editar</Button>
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(client.id)} className="text-red-600 hover:text-red-700">Borrar</Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Cliente</th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Tipo</th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Contacto</th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Ubicación</th>
                  <th className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Facturas</th>
                  <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <Link href={`/clientes/${client.id}`} className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-sm">
                          {client.name}
                        </Link>
                        {client.nif && <p className="text-xs text-slate-400">{client.nif}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={client.client_type === "empresa" ? "green" : "blue"} size="sm">
                        {client.client_type === "empresa" ? "Empresa" : "Particular"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {client.phone ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-700 font-medium">{client.phone}</span>
                            <WhatsAppButton compact phone={client.phone} />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                        {client.email && (
                          <a href={`mailto:${client.email}`} className="text-xs text-blue-600 hover:underline block truncate max-w-[180px]">
                            {client.email}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      {client.city || client.province ? (
                        <span>{client.city} {client.province ? `(${client.province})` : ""}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {client.invoice_count !== undefined && client.invoice_count > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                          <FileText className="h-3 w-3" />
                          {client.invoice_count}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/clientes/${client.id}`}>
                          <Button variant="ghost" size="sm" icon={Eye}>Ver</Button>
                        </Link>
                        <Button variant="ghost" size="sm" icon={Edit2} onClick={() => handleEdit(client)}>Editar</Button>
                        <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(client.id)} className="text-red-600 hover:text-red-700">Borrar</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
