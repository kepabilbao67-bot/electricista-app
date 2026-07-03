"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Send, CheckCircle, Shield, Download, ExternalLink, QrCode, FileCode, AlertCircle, Upload, Mail, Copy } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { showToast } from "@/components/Toast";

interface InvoiceDetail {
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
  due_date: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string;
  payment_method: string | null;
  ticketbai_id: string | null;
  ticketbai_qr: string | null;
  ticketbai_signature: string | null;
  created_at: string;
  updated_at: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    discount: number;
    discount_type: string;
  }>;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-slate-100 text-slate-600" },
  pending_batuz: { label: "Pendiente Batuz", color: "bg-amber-50 text-amber-700 border border-amber-200" },
  sent: { label: "Enviada/TBAI", color: "bg-blue-50 text-blue-700 border border-blue-100" },
  paid: { label: "Cobrada", color: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  overdue: { label: "Vencida", color: "bg-red-50 text-red-700 border border-red-100" },
};

const paymentMethodLabels: Record<string, string> = {
  transferencia: "Transferencia bancaria",
  efectivo: "Efectivo",
  bizum: "Bizum",
};

export default function FacturaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState({ ticketbai_id: "", ticketbai_signature: "", ticketbai_qr: "" });
  const [tbaiResult, setTbaiResult] = useState<{ xml: string; instructions: string[] } | null>(null);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/invoices/${params.id}`)
        .then((r) => r.json())
        .then((data) => { setInvoice(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [params.id]);

  const generateTicketBAI = async () => {
    if (!invoice) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ticketbai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoice.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvoice({ ...invoice, ticketbai_id: data.ticketbaiId, ticketbai_qr: data.qrCode, ticketbai_signature: data.signature, status: "pending_batuz" });
        setTbaiResult({ xml: data.xml, instructions: data.instructions });
      }
    } catch (err) { console.error(err); }
    setGenerating(false);
  };

  const downloadXml = () => {
    if (!invoice) return;
    window.open(`/api/invoices/${invoice.id}/ticketbai-xml`, "_blank");
  };

  const confirmBatuz = async () => {
    if (!invoice) return;
    try {
      const res = await fetch("/api/ticketbai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoice.id, action: "confirm",
          ticketbai_id: confirmData.ticketbai_id || invoice.ticketbai_id,
          ticketbai_signature: confirmData.ticketbai_signature || invoice.ticketbai_signature,
          ticketbai_qr: confirmData.ticketbai_qr || invoice.ticketbai_qr,
        }),
      });
      if (res.ok) {
        setInvoice({ ...invoice, ticketbai_id: confirmData.ticketbai_id || invoice.ticketbai_id, ticketbai_signature: confirmData.ticketbai_signature || invoice.ticketbai_signature, ticketbai_qr: confirmData.ticketbai_qr || invoice.ticketbai_qr, status: "sent" });
        setShowConfirmModal(false);
        setTbaiResult(null);
      }
    } catch (err) { console.error(err); }
  };

  const markPaid = async () => {
    if (!invoice) return;
    await fetch(`/api/invoices/${invoice.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    setInvoice({ ...invoice, status: "paid" });
    showToast("success", "Factura marcada como cobrada");
  };

  const sendByEmail = () => {
    if (!invoice) return;
    const subject = encodeURIComponent(`Factura ${invoice.number} - Ivan Martin Oyarzabal`);
    const body = encodeURIComponent(
      `Estimado/a ${invoice.client_name},\n\nAdjunto le remito la factura ${invoice.number} por importe de ${invoice.total.toFixed(2)} EUR.\n\nDatos de pago:\nBBVA: ES66 0182 0450 1102 0150 3156\nTitular: MARTIN OYARZABAL IVAN\n\nQuedo a su disposicion.\n\nUn saludo,\nIvan Martin Oyarzabal\nTfno: 688 867 530`
    );
    const email = invoice.client_email || "";
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
  };

  const duplicateInvoice = async () => {
    if (!invoice) return;
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: invoice.id,
          date: new Date().toISOString().split("T")[0],
          notes: invoice.notes || "",
          tax_rate: invoice.tax_rate || 21,
          items: (invoice.items || []).map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
        }),
      });
      if (res.ok) {
        const newInv = await res.json();
        showToast("success", `Factura duplicada: ${newInv.number}`);
        router.push(`/facturas/${newInv.id}`);
      }
    } catch { showToast("error", "Error al duplicar"); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-800 border-t-transparent"></div>
      </div>
    );
  }

  if (!invoice) {
    return <div className="text-center py-8 text-slate-500">Factura no encontrada</div>;
  }

  const status = statusLabels[invoice.status] || statusLabels.draft;
  const watermarkText = invoice.status === "paid" ? "PAGADO" : (invoice.status === "draft" || invoice.status === "pending_batuz") ? "BORRADOR" : "";

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <Breadcrumbs items={[{ label: "Facturas", href: "/facturas" }, { label: invoice.number }]} />

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 no-print">
        <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Factura {invoice.number}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>{status.label}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {invoice.status !== "paid" && (
            <button onClick={markPaid} className="btn-success">
              <CheckCircle className="h-4 w-4" />
              Cobrada
            </button>
          )}
          <button onClick={sendByEmail} className="btn-primary">
            <Mail className="h-4 w-4" />
            Enviar email
          </button>
          <button onClick={duplicateInvoice} className="btn-secondary">
            <Copy className="h-4 w-4" />
            Duplicar
          </button>
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* FLUJO BATUZ */}
      <div className="card-static mb-6 border-blue-200 bg-gradient-to-br from-blue-50/50 to-white no-print">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
              <Shield className="h-6 w-6 text-blue-800" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-blue-900">TicketBAI / Batuz</h2>
              <p className="text-xs text-blue-600">Sistema fiscal Diputacion Foral de Bizkaia</p>
            </div>
          </div>

          {!invoice.ticketbai_id && invoice.status === "draft" && (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">Factura en borrador</p>
                  <p className="text-sm text-slate-500 mt-1">Genera el XML de TicketBAI para subirlo a Batuz.</p>
                </div>
              </div>
              <button onClick={generateTicketBAI} disabled={generating} className="btn-primary w-full justify-center">
                <Send className="h-4 w-4" />
                {generating ? "Generando XML..." : "Generar XML para Batuz"}
              </button>
            </div>
          )}

          {invoice.ticketbai_id && invoice.status === "pending_batuz" && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800">Pendiente de subir a Batuz</p>
                    <p className="text-sm text-amber-700 mt-1">El XML esta generado. Descargalo y subelo a Batuz.</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button onClick={downloadXml} className="btn-primary justify-center">
                  <Download className="h-4 w-4" />
                  Descargar XML TicketBAI
                </button>
                <button onClick={() => setShowConfirmModal(true)} className="btn-success justify-center">
                  <Upload className="h-4 w-4" />
                  Confirmar datos de Batuz
                </button>
              </div>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Codigo TBAI provisional</p>
                <p className="text-sm font-mono text-slate-600 break-all">{invoice.ticketbai_id}</p>
              </div>
            </div>
          )}

          {invoice.ticketbai_id && invoice.status !== "pending_batuz" && invoice.status !== "draft" && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-emerald-800">Factura registrada en Batuz</p>
                    <p className="text-xs text-emerald-600">TicketBAI confirmado</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-emerald-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Codigo TBAI</p>
                <p className="text-base font-mono font-bold text-slate-800 break-all">{invoice.ticketbai_id}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {invoice.ticketbai_qr && (
                  <a href={invoice.ticketbai_qr} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-all justify-center">
                    <QrCode className="h-4 w-4" />
                    Verificar QR en Batuz
                  </a>
                )}
                <button onClick={downloadXml} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all justify-center">
                  <FileCode className="h-4 w-4" />
                  Descargar XML
                </button>
              </div>
              {invoice.ticketbai_signature && (
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Firma digital</p>
                  <p className="text-xs font-mono text-slate-500 break-all">{invoice.ticketbai_signature}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal confirmar Batuz */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Confirmar datos de Batuz</h3>
            <p className="text-sm text-slate-500 mb-4">Pega aqui los datos que te ha dado Batuz al procesar la factura.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Codigo TBAI</label>
                <input type="text" value={confirmData.ticketbai_id} onChange={(e) => setConfirmData({ ...confirmData, ticketbai_id: e.target.value })} placeholder={invoice.ticketbai_id || "TBAI-16063731W-..."} className="input-field font-mono text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Firma digital</label>
                <input type="text" value={confirmData.ticketbai_signature} onChange={(e) => setConfirmData({ ...confirmData, ticketbai_signature: e.target.value })} placeholder={invoice.ticketbai_signature || "Firma..."} className="input-field font-mono text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">URL del QR</label>
                <input type="text" value={confirmData.ticketbai_qr} onChange={(e) => setConfirmData({ ...confirmData, ticketbai_qr: e.target.value })} placeholder={invoice.ticketbai_qr || "https://batuz.eus/..."} className="input-field font-mono text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowConfirmModal(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
              <button onClick={confirmBatuz} className="btn-success flex-1 justify-center">Confirmar TBAI</button>
            </div>
          </div>
        </div>
      )}

      {/* XML Preview */}
      {tbaiResult && (
        <div className="card-static mb-6 border-slate-200 no-print">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">XML TicketBAI generado</h3>
            <button onClick={() => setTbaiResult(null)} className="text-sm text-slate-400 hover:text-slate-600">Cerrar</button>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-600 overflow-x-auto max-h-64 bg-slate-50">{tbaiResult.xml}</pre>
        </div>
      )}

      {/* Factura imprimible */}
      <div className="card-static p-8 print:shadow-none print:border-none relative overflow-hidden">
        {/* Watermark for print */}
        {watermarkText && (
          <div className="print-watermark text-slate-400">{watermarkText}</div>
        )}

        {/* Header */}
        <div className="flex justify-between mb-8 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">MARTIN OYARZABAL, IVAN</h2>
            <p className="text-sm text-slate-500 mt-1">NIF: 16063731W</p>
            <p className="text-sm text-slate-500">Lehendakari Aguirre 7b 2 derecha</p>
            <p className="text-sm text-slate-500">48640 Berango, Bizkaia</p>
            <p className="text-sm text-slate-500 mt-2 font-medium">Tel: 688 867 530</p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 border border-blue-100 mb-2">
              <span className="text-lg font-bold text-blue-800">
                {invoice.status === "draft" || invoice.status === "pending_batuz" ? "BORRADOR" : "FACTURA"}
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900">{invoice.number}</p>
            <p className="text-sm text-slate-500 mt-2">Fecha: {formatDate(invoice.date)}</p>
            {invoice.payment_method && (
              <p className="text-sm text-slate-500 mt-1">Forma de pago: {paymentMethodLabels[invoice.payment_method] || invoice.payment_method}</p>
            )}
          </div>
        </div>

        {/* Client */}
        <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Destinatario</p>
          <p className="font-semibold text-slate-900">{invoice.client_name}</p>
          {invoice.client_nif && <p className="text-sm text-slate-600">NIF: {invoice.client_nif}</p>}
          {invoice.client_address && <p className="text-sm text-slate-600">{invoice.client_address}</p>}
          {invoice.client_city && (
            <p className="text-sm text-slate-600">{invoice.client_postal_code} {invoice.client_city}, {invoice.client_province}</p>
          )}
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">Descripcion</p>
            <p className="text-sm text-blue-800">{invoice.notes}</p>
          </div>
        )}

        {/* Items - Grouped by zone if applicable */}
        {(() => {
          const hasZones = invoice.items.some((item) => item.description.match(/^\[([^\]]+)\]/));
          
          if (hasZones) {
            // Group items by zone
            const zoneGroups: { name: string; items: typeof invoice.items; subtotal: number }[] = [];
            const zoneMap = new Map<string, typeof invoice.items>();
            
            for (const item of invoice.items) {
              const match = item.description.match(/^\[([^\]]+)\]\s*(.*)$/);
              const zoneName = match ? match[1] : "General";
              if (!zoneMap.has(zoneName)) zoneMap.set(zoneName, []);
              zoneMap.get(zoneName)!.push({ ...item, description: match ? match[2] : item.description });
            }
            
            zoneMap.forEach((items, name) => {
              zoneGroups.push({ name, items, subtotal: items.reduce((acc, i) => acc + i.total, 0) });
            });

            return (
              <div className="space-y-8 mb-6">
                {zoneGroups.map((group) => (
                  <div key={group.name}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-bold text-indigo-800 uppercase tracking-wide">{group.name}</h3>
                      <span className="text-base font-bold text-indigo-600">{group.subtotal.toFixed(2)} EUR</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="pb-2 text-left text-xs font-medium text-slate-500">Descripcion</th>
                          <th className="pb-2 text-right text-xs font-medium text-slate-500 w-16">Cant.</th>
                          <th className="pb-2 text-right text-xs font-medium text-slate-500 w-24">Precio</th>
                          <th className="pb-2 text-right text-xs font-medium text-slate-500 w-28">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {group.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 text-slate-700">{item.description}</td>
                            <td className="py-2 text-right text-slate-600">{item.quantity}</td>
                            <td className="py-2 text-right text-slate-600">{item.unit_price.toFixed(2)} EUR</td>
                            <td className="py-2 text-right font-medium text-slate-900">{item.total.toFixed(2)} EUR</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            );
          }

          // No zones - flat table
          return (
            <div className="overflow-hidden rounded-lg border border-slate-200 mb-6">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Detalle</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-16">Cant.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-24">Precio</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">Dto.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item) => {
                    const discountDisplay = item.discount && item.discount > 0
                      ? (item.discount_type === "percent" ? `${item.discount}%` : `${item.discount.toFixed(2)} EUR`)
                      : "-";
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-slate-700">{item.description}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{item.quantity.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{item.unit_price.toFixed(2)} EUR</td>
                        <td className="px-4 py-3 text-right text-slate-400">{discountDisplay}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{item.total.toFixed(2)} EUR</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72">
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="flex justify-between px-4 py-2 text-sm bg-slate-50">
                <span className="text-slate-500">Base imponible</span>
                <span className="font-medium text-slate-700">{invoice.subtotal.toFixed(2)} EUR</span>
              </div>
              <div className="flex justify-between px-4 py-2 text-sm border-t border-slate-100">
                <span className="text-slate-500">IVA {invoice.tax_rate.toFixed(0)}%</span>
                <span className="font-medium text-slate-700">{invoice.tax_amount.toFixed(2)} EUR</span>
              </div>
              <div className="flex justify-between px-4 py-3 text-lg font-bold border-t-2 border-slate-300 bg-slate-50">
                <span className="text-slate-900">TOTAL</span>
                <span className="text-slate-900">{invoice.total.toFixed(2)} EUR</span>
              </div>
            </div>
          </div>
        </div>

        {/* TBAI footer */}
        {invoice.ticketbai_id && invoice.status === "sent" && (
          <div className="mt-8 pt-4 border-t border-slate-200">
            <p className="text-xs font-mono text-slate-500">{invoice.ticketbai_id}</p>
            {invoice.ticketbai_qr && (
              <p className="text-xs font-mono text-slate-400 mt-1">{invoice.ticketbai_qr}</p>
            )}
          </div>
        )}

        {/* Footer with electrician data */}
        <div className="mt-8 pt-4 border-t border-slate-200">
          <div className="flex justify-between text-xs text-slate-400">
            <div>
              <p className="font-semibold text-slate-500">MARTIN OYARZABAL, IVAN</p>
              <p>NIF: 16063731W | Tel: 688 867 530</p>
              <p>Lehendakari Aguirre 7b 2 dcha, 48640 Berango, Bizkaia</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-500">Datos bancarios</p>
              <p>BBVA: ES66 0182 0450 1102 0150 3156</p>
              {invoice.payment_method && (
                <p>Forma de pago: {paymentMethodLabels[invoice.payment_method] || invoice.payment_method}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
