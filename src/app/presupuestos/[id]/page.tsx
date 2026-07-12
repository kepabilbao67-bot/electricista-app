"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, FileText, Send, Pencil, Mail } from "lucide-react";
import { showToast } from "@/components/Toast";

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
        router.push(`/facturas/${invoice.id}`);
      }
    } catch (err) {
      console.error(err);
    }
    setConverting(false);
  };

  const markSent = async () => {
    if (!budget) return;
    await fetch(`/api/budgets/${budget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" }),
    });
    setBudget({ ...budget, status: "sent" });
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

    const subject = `Presupuesto ${budget.number} - Autonomo360`;
    const validUntilLine = budget.valid_until ? `\nVálido hasta: ${budget.valid_until}` : "";
    const body = `Hola,\n\nTe envío el presupuesto solicitado.\n\nAdjunto el presupuesto en PDF para que puedas revisarlo con todos los conceptos, importes e IVA desglosados.\n\nResumen:\nPresupuesto: ${budget.number}\nFecha: ${budget.date}\nCliente: ${budget.client_name}\nTotal: ${budget.total.toFixed(2)} €\nEstado: ${statusLabel}${validUntilLine}\n\nPuedes responder a este correo si estás conforme o necesitas algún ajuste.\n\nUn saludo,\nKepa`;

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
        <div className="ml-auto flex gap-2">
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
          {!budget.converted_invoice_id && budget.status !== "rejected" && (
            <button
              onClick={convertToInvoice}
              disabled={converting}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
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

      <div className="budget-print rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:shadow-none print:border-none">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">MARTIN OYARZABAL, IVAN</h2>
            <p className="text-sm text-gray-500">NIF: 16063731W</p>
            <p className="text-sm text-gray-500">Lehendakari Aguirre 7b 2 derecha</p>
            <p className="text-sm text-gray-500">48640 Berango, Bizkaia</p>
            <p className="text-sm text-gray-500">Teléfono: 609421750</p>
            <p className="text-sm text-gray-500">Email: sh.electricas@gmail.com</p>
          </div>

          {/* Logo S&H inline */}
          <div className="flex flex-col items-center mx-4">
            <div className="flex items-center justify-center rounded-full border-4 border-gray-900" style={{ width: "120px", height: "120px", position: "relative" }}>
              <div className="flex items-center justify-center rounded-full border-2 border-red-600" style={{ width: "100px", height: "100px", backgroundColor: "#1a1a1a" }}>
                <div className="flex flex-col items-center">
                  <span className="text-white font-bold" style={{ fontSize: "28px", lineHeight: "1" }}>S&H</span>
                  <span className="text-red-600 font-bold" style={{ fontSize: "16px", lineHeight: "1.2" }}>⚡</span>
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-gray-800 mt-1 tracking-wider">S&H ELÉCTRICAS</span>
          </div>

          <div className="text-right">
            <p className="text-2xl font-bold text-yellow-600">PRESUPUESTO</p>
            <p className="text-lg font-medium">{budget.number}</p>
            <p className="text-sm text-gray-500 mt-2">Fecha: {budget.date}</p>
            {budget.valid_until && (
              <p className="text-sm text-gray-500">Valido hasta: {budget.valid_until}</p>
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
                      <th className="pb-1 text-left font-medium text-gray-500 text-xs">Descripcion</th>
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
                <th className="pb-2 text-left font-medium">Descripcion</th>
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
  );
}
