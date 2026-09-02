"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, FileText, Send, Pencil, Mail, ClipboardCheck } from "lucide-react";
import { showToast } from "@/components/Toast";
import WhatsAppButton from "@/components/WhatsAppButton";
import { COMPANY_PROFILE } from "@/lib/company-profile";
import { APP_CONFIG } from "@/config/app-config";

interface BudgetItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface BudgetDetail {
  id: string;
  number: string;
  client_name: string;
  client_nif: string;
  client_address: string;
  client_city: string;
  client_postal_code: string;
  client_province: string;
  client_email?: string;
  client_phone?: string;
  date: string;
  valid_until: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string;
  converted_invoice_id: string | null;
  items: BudgetItem[];
}

interface ZoneGroup {
  name: string;
  items: BudgetItem[];
  subtotal: number;
}

function parseZoneFromDescription(description: string): { zone: string; desc: string } {
  const match = description.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) {
    return { zone: match[1], desc: match[2] };
  }
  return { zone: "General", desc: description };
}

function groupItemsByZone(items: BudgetItem[]): ZoneGroup[] {
  const groups: Map<string, BudgetItem[]> = new Map();

  for (const item of items) {
    const { zone } = parseZoneFromDescription(item.description);
    if (!groups.has(zone)) {
      groups.set(zone, []);
    }
    groups.get(zone)!.push(item);
  }

  return Array.from(groups.entries()).map(([name, zoneItems]) => ({
    name,
    items: zoneItems,
    subtotal: zoneItems.reduce((acc, i) => acc + i.total, 0),
  }));
}

export default function PresupuestoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [budget, setBudget] = useState<BudgetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [creatingParte, setCreatingParte] = useState(false);
  const [company, setCompany] = useState({
    legalName: COMPANY_PROFILE.legalName,
    tradeName: COMPANY_PROFILE.tradeName,
    nif: COMPANY_PROFILE.nif,
    addressLine1: COMPANY_PROFILE.addressLine1,
    addressLine2: COMPANY_PROFILE.addressLine2,
    phone: COMPANY_PROFILE.phone,
    email: COMPANY_PROFILE.email,
    iban: COMPANY_PROFILE.iban,
    bankName: COMPANY_PROFILE.bankName,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((settings) => {
        if (settings) {
          setCompany({
            legalName: settings.legal_name || settings.trade_name || COMPANY_PROFILE.legalName,
            tradeName: settings.trade_name || COMPANY_PROFILE.tradeName,
            nif: settings.nif || COMPANY_PROFILE.nif,
            addressLine1: settings.address_line1 || COMPANY_PROFILE.addressLine1,
            addressLine2: settings.address_line2 || COMPANY_PROFILE.addressLine2,
            phone: settings.phone || COMPANY_PROFILE.phone,
            email: settings.email || COMPANY_PROFILE.email,
            iban: settings.iban || COMPANY_PROFILE.iban,
            bankName: settings.bank_name || COMPANY_PROFILE.bankName,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/budgets/${params.id}`)
        .then((r) => r.json())
        .then((data) => {
          setBudget(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [params.id]);

  const createParte = async () => {
    if (!budget) return;
    setCreatingParte(true);
    try {
      const res = await fetch(`/api/budgets/${budget.id}/create-parte`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", `Parte de trabajo creado: ${data.numero}`);
        router.push(`/partes-trabajo/${data.id}`);
      } else {
        showToast("error", data.error || "Error al crear parte de trabajo");
        if (data.parteId) {
          router.push(`/partes-trabajo/${data.parteId}`);
        }
      }
    } catch {
      showToast("error", "Error de conexión al crear parte de trabajo");
    } finally {
      setCreatingParte(false);
    }
  };

  const convertToInvoice = async () => {
    if (!budget) return;
    setConverting(true);
    try {
      const res = await fetch("/api/budgets/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget_id: budget.id }),
      });
      if (res.ok) {
        const invoice = await res.json();
        showToast("success", `Factura creada: ${invoice.number}`);
        router.push(`/facturas/${invoice.id}`);
      } else {
        const err = await res.json();
        showToast("error", err.error || "Error al convertir presupuesto a factura");
      }
    } catch {
      showToast("error", "Error de conexión al convertir a factura");
    } finally {
      setConverting(false);
    }
  };

  const markSent = async () => {
    if (!budget) return;
    await fetch(`/api/budgets/${budget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" }),
    });
    setBudget({ ...budget, status: "sent" });
    showToast("success", "Presupuesto marcado como enviado");
  };

  const sendByEmail = () => {
    if (!budget) return;
    if (!budget.client_name) {
      showToast("error", "Asigna un cliente con email antes de enviar este presupuesto.");
      return;
    }
    if (!budget.client_email) {
      showToast("error", "Este cliente no tiene email asociado.");
      return;
    }

    const statusLabel =
      budget.status === "draft"
        ? "Borrador"
        : budget.status === "sent"
          ? "Enviado"
          : budget.status === "accepted"
            ? "Aceptado"
            : budget.status === "rejected"
              ? "Rechazado"
              : budget.status;

    const subject = `Presupuesto ${budget.number} - ${COMPANY_PROFILE.tradeName}`;
    const validUntilLine = budget.valid_until ? `\nVálido hasta: ${budget.valid_until}` : "";
    const body = `Hola,\n\nTe envío el presupuesto solicitado.\n\nAdjunto el presupuesto en PDF para que puedas revisarlo con todos los conceptos, importes e IVA desglosados.\n\nResumen:\nPresupuesto: ${budget.number}\nFecha: ${budget.date}\nCliente: ${budget.client_name}\nTotal: ${budget.total.toFixed(2)} €\nEstado: ${statusLabel}${validUntilLine}\n\nPuedes responder a este correo si estás conforme o necesitas algún ajuste.\n\nUn saludo,\n${COMPANY_PROFILE.ownerName}`;

    const gmailParams = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: budget.client_email,
      su: subject,
      body,
    });

    showToast("success", "Recuerda adjuntar el PDF del presupuesto en Gmail.");
    window.location.href = `https://mail.google.com/mail/?${gmailParams.toString()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (!budget) {
    return <div className="text-center py-8 text-gray-500">Presupuesto no encontrado</div>;
  }

  const hasZones = budget.items.some((item) => item.description.match(/^\[([^\]]+)\]/));
  const zoneGroups = hasZones ? groupItemsByZone(budget.items) : null;

  return (
    <div className="budget-page max-w-4xl mx-auto">
      <div className="no-print flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Presupuesto {budget.number}</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => router.push(`/presupuestos/${budget.id}/editar`)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          {budget.status === "draft" && (
            <button
              onClick={markSent}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              <Send className="h-4 w-4" />
              Marcar enviado
            </button>
          )}
          <button
            onClick={sendByEmail}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Mail className="h-4 w-4" />
            Enviar por Gmail
          </button>
          {budget.client_phone && (
            <WhatsAppButton
              phone={budget.client_phone}
              label="Abrir WhatsApp"
              message={`Hola ${budget.client_name || ""}, hemos preparado el presupuesto ${budget.number} por ${budget.total.toFixed(2)} EUR. Puedes revisarlo antes de confirmar si estás conforme o necesitas algún ajuste.`}
            />
          )}
          {budget.status !== "rejected" && (
            <button
              onClick={createParte}
              disabled={creatingParte}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              title="Crear Parte de Trabajo con las líneas de este presupuesto"
            >
              <ClipboardCheck className="h-4 w-4" />
              {creatingParte ? "Creando parte..." : "Crear parte"}
            </button>
          )}
          {!budget.converted_invoice_id && budget.status !== "rejected" && (
            <button
              onClick={convertToInvoice}
              disabled={converting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {converting ? "Convirtiendo..." : "Convertir a factura"}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            Guardar PDF / Imprimir
          </button>
        </div>
      </div>

      <div className="budget-print rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:shadow-none print:border-none relative overflow-hidden">
        {/* Marca de agua PRESUPUESTO */}
        <div className="print-watermark text-gray-400">PRESUPUESTO</div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{company.legalName}</h2>
              <p className="text-sm text-gray-500">NIF: {company.nif}</p>
              {company.addressLine1 && <p className="text-sm text-gray-500">{company.addressLine1}</p>}
              {company.addressLine2 && <p className="text-sm text-gray-500">{company.addressLine2}</p>}
              <p className="text-sm text-gray-500">Teléfono: {company.phone}</p>
              <p className="text-sm text-gray-500">Email: {company.email}</p>
              {company.iban && <p className="text-xs text-gray-400 mt-0.5">IBAN: {company.iban}</p>}
            </div>

            {/* Logo de empresa */}
            <div className="flex flex-col items-center mx-4">
              <div className="flex items-center justify-center rounded-2xl bg-slate-900 shadow-md ring-1 ring-slate-200 p-2" style={{ width: "80px", height: "80px" }}>
                <img src={APP_CONFIG.company.logo || "/logo-generic.svg"} alt="Logo" className="h-14 w-14 object-contain" />
              </div>
              <span className="text-[11px] font-bold text-gray-800 mt-1.5 tracking-wider uppercase">{company.tradeName}</span>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold text-yellow-600">PRESUPUESTO</p>
              <p className="text-lg font-medium">{budget.number}</p>
              <p className="text-sm text-gray-500 mt-2">Fecha: {budget.date}</p>
              {budget.valid_until && (
                <p className="text-sm text-gray-500">Válido hasta: {budget.valid_until}</p>
              )}
            </div>
          </div>

          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-500 mb-1">Cliente:</p>
            <p className="font-medium">{budget.client_name}</p>
            {budget.client_nif && <p className="text-sm text-gray-600">NIF: {budget.client_nif}</p>}
            {budget.client_address && <p className="text-sm text-gray-600">{budget.client_address}</p>}
            {budget.client_city && (
              <p className="text-sm text-gray-600">
                {budget.client_postal_code} {budget.client_city}, {budget.client_province}
              </p>
            )}
          </div>

          {zoneGroups ? (
            <div className="space-y-6 mb-6">
              {zoneGroups.map((group) => (
                <div key={group.name}>
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-blue-100">
                    <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide">{group.name}</h3>
                    <span className="text-sm font-medium text-blue-600">{group.subtotal.toFixed(2)} EUR</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <th className="pb-1 text-left font-medium text-gray-500 text-xs">Descripción</th>
                        <th className="pb-1 text-right font-medium text-gray-500 text-xs w-16">Cant.</th>
                        <th className="pb-1 text-right font-medium text-gray-500 text-xs w-24">Precio</th>
                        <th className="pb-1 text-right font-medium text-gray-500 text-xs w-24">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {group.items.map((item) => {
                        const { desc } = parseZoneFromDescription(item.description);
                        return (
                          <tr key={item.id}>
                            <td className="py-1.5">{desc}</td>
                            <td className="py-1.5 text-right">{item.quantity}</td>
                            <td className="py-1.5 text-right">{item.unit_price.toFixed(2)} EUR</td>
                            <td className="py-1.5 text-right">{item.total.toFixed(2)} EUR</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-sm mb-6">
              <thead className="border-b-2 border-gray-200">
                <tr>
                  <th className="pb-2 text-left font-medium">Descripción</th>
                  <th className="pb-2 text-right font-medium w-20">Cant.</th>
                  <th className="pb-2 text-right font-medium w-28">Precio</th>
                  <th className="pb-2 text-right font-medium w-28">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {budget.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2">{item.description}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">{item.unit_price.toFixed(2)} EUR</td>
                    <td className="py-2 text-right">{item.total.toFixed(2)} EUR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="budget-totals border-t-2 border-gray-200 pt-4 text-right space-y-1">
            <p className="text-sm">Base imponible: {budget.subtotal.toFixed(2)} EUR</p>
            <p className="text-sm">IVA {budget.tax_rate}%: {budget.tax_amount.toFixed(2)} EUR</p>
            <p className="text-xl font-bold">Total: {budget.total.toFixed(2)} EUR</p>
          </div>

          {budget.notes && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">{budget.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
