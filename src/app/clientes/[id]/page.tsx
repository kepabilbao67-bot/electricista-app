"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MessageCircle, FileText, ClipboardList, MapPin, User, Building2, StickyNote } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface ClientDetail {
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
}

interface Invoice {
  id: string;
  number: string;
  date: string;
  total: number;
  status: string;
}

interface Budget {
  id: string;
  number: string;
  date: string;
  total: number;
  status: string;
}

interface Communication {
  id: string;
  type: string;
  subject: string;
  message: string;
  created_at: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-slate-100 text-slate-600" },
  sent: { label: "Enviada", color: "bg-blue-50 text-blue-700" },
  paid: { label: "Cobrada", color: "bg-emerald-50 text-emerald-700" },
  overdue: { label: "Vencida", color: "bg-red-50 text-red-700" },
  pending_batuz: { label: "Pte. Batuz", color: "bg-amber-50 text-amber-700" },
  accepted: { label: "Aceptado", color: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rechazado", color: "bg-red-50 text-red-700" },
};

export default function ClienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      Promise.all([
        fetch(`/api/clients/${params.id}`).then((r) => r.json()),
        fetch(`/api/invoices?client_id=${params.id}`).then((r) => r.json()).catch(() => []),
        fetch(`/api/budgets?client_id=${params.id}`).then((r) => r.json()).catch(() => []),
        fetch(`/api/communications?client_id=${params.id}`).then((r) => r.json()).catch(() => []),
      ]).then(([clientData, invoiceData, budgetData, commData]) => {
        setClient(clientData);
        setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
        setBudgets(Array.isArray(budgetData) ? budgetData : []);
        setCommunications(Array.isArray(commData) ? commData : []);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [params.id]);

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

  if (!client) {
    return <div className="text-center py-8 text-slate-500">Cliente no encontrado</div>;
  }

  const totalFacturado = invoices.reduce((acc, inv) => acc + inv.total, 0);
  const totalCobrado = invoices.filter((inv) => inv.status === "paid").reduce((acc, inv) => acc + inv.total, 0);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <Breadcrumbs items={[{ label: "Clientes", href: "/clientes" }, { label: client.name }]} />

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
            {client.client_type && (
              <span className={`badge ${client.client_type === "empresa" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-slate-100 text-slate-600"}`}>
                {client.client_type === "empresa" ? <Building2 className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                {client.client_type === "empresa" ? "Empresa" : "Particular"}
              </span>
            )}
          </div>
          {client.nif && <p className="text-sm text-slate-500 mt-0.5">NIF: {client.nif}</p>}
        </div>
      </div>

      {/* Client Info Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card-static lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Contacto</h3>
          <div className="space-y-3">
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-600">{client.phone}</span>
                <a href={`tel:${client.phone}`} className="rounded-md p-1 text-blue-600 hover:bg-blue-50" title="Llamar">
                  <Phone className="h-3.5 w-3.5" />
                </a>
                <a href={`https://wa.me/${formatPhoneForWhatsApp(client.phone)}`} target="_blank" rel="noopener noreferrer" className="rounded-md p-1 text-emerald-600 hover:bg-emerald-50" title="WhatsApp">
                  <MessageCircle className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-slate-400" />
                <a href={`mailto:${client.email}`} className="text-sm text-blue-700 hover:underline">{client.email}</a>
              </div>
            )}
            {client.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="text-sm text-slate-600">
                  <p>{client.address}</p>
                  <p>{client.postal_code} {client.city}, {client.province}</p>
                </div>
              </div>
            )}
            {client.notes && (
              <div className="flex items-start gap-3 mt-4 pt-4 border-t border-slate-100">
                <StickyNote className="h-4 w-4 text-amber-500 mt-0.5" />
                <p className="text-sm text-slate-600 italic">{client.notes}</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-lg font-bold text-slate-900">{totalFacturado.toFixed(0)} EUR</p>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Total facturado</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-lg font-bold text-emerald-700">{totalCobrado.toFixed(0)} EUR</p>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Cobrado</p>
            </div>
          </div>
        </div>

        {/* Invoices & Budgets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoices */}
          <div className="card-static">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-700" />
                Facturas ({invoices.length})
              </h3>
              <Link href="/facturas/nueva" className="text-xs text-blue-700 hover:underline font-medium">+ Nueva</Link>
            </div>
            {invoices.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sin facturas</p>
            ) : (
              <div className="space-y-2">
                {invoices.slice(0, 10).map((inv) => {
                  const st = statusLabels[inv.status] || statusLabels.draft;
                  return (
                    <Link key={inv.id} href={`/facturas/${inv.id}`} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-blue-800">{inv.number}</span>
                        <span className={`badge text-[10px] ${st.color}`}>{st.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500">{formatDate(inv.date)}</span>
                        <span className="text-sm font-bold text-slate-900">{inv.total.toFixed(2)} EUR</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Budgets */}
          <div className="card-static">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-amber-600" />
                Presupuestos ({budgets.length})
              </h3>
              <Link href="/presupuestos/nuevo" className="text-xs text-blue-700 hover:underline font-medium">+ Nuevo</Link>
            </div>
            {budgets.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sin presupuestos</p>
            ) : (
              <div className="space-y-2">
                {budgets.slice(0, 10).map((b) => {
                  const st = statusLabels[b.status] || statusLabels.draft;
                  return (
                    <Link key={b.id} href={`/presupuestos/${b.id}`} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-700">{b.number}</span>
                        <span className={`badge text-[10px] ${st.color}`}>{st.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500">{formatDate(b.date)}</span>
                        <span className="text-sm font-bold text-slate-900">{b.total.toFixed(2)} EUR</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Communications */}
          <div className="card-static">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              Comunicaciones ({communications.length})
            </h3>
            {communications.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sin comunicaciones</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {communications.map((comm) => (
                  <div key={comm.id} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-600 capitalize">{comm.type}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(comm.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </span>
                    </div>
                    {comm.subject && <p className="text-xs font-medium text-slate-700">{comm.subject}</p>}
                    <p className="text-xs text-slate-500 line-clamp-2">{comm.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
