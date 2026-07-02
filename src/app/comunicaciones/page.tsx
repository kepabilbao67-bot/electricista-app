"use client";

import { useEffect, useState } from "react";
import { Send, MessageSquare, Mail, Phone, ExternalLink, Filter, Copy, CheckCircle2 } from "lucide-react";
import { templates } from "@/lib/templates";
import { showToast } from "@/components/Toast";

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface Communication {
  id: string;
  client_id: string;
  client_name: string;
  type: string;
  subject: string;
  message: string;
  created_at: string;
}

export default function ComunicacionesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [messageType, setMessageType] = useState<"whatsapp" | "email" | "sms">("whatsapp");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/communications").then((r) => r.json()),
    ]).then(([clientsData, commsData]) => {
      setClients(clientsData);
      setCommunications(commsData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const formatPhoneForWhatsApp = (phone: string) => {
    let cleaned = phone.replace(/[\s\-\(\)]/g, "");
    if (cleaned.startsWith("6") || cleaned.startsWith("7") || cleaned.startsWith("9")) {
      cleaned = "34" + cleaned;
    } else if (cleaned.startsWith("+")) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setMessageType(template.type);
      setSubject(template.subject || "");
      const client = clients.find((c) => c.id === selectedClient);
      let body = template.body;
      if (client) {
        body = body.replace(/\{nombre\}/g, client.name);
      }
      setMessage(body);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !message) return;
    setSending(true);

    const res = await fetch("/api/communications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: selectedClient,
        type: messageType,
        subject: subject || null,
        message,
      }),
    });

    if (res.ok) {
      showToast("success", "Comunicacion registrada correctamente");
      setMessage("");
      setSubject("");
      setSelectedTemplate("");
      fetch("/api/communications").then((r) => r.json()).then(setCommunications);
    } else {
      showToast("error", "Error al registrar la comunicacion");
    }
    setSending(false);
  };

  const copyToClipboard = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      showToast("success", "Mensaje copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("error", "No se pudo copiar el mensaje");
    }
  };

  const getWhatsAppLink = () => {
    const client = clients.find((c) => c.id === selectedClient);
    if (!client?.phone || !message) return null;
    const phone = formatPhoneForWhatsApp(client.phone);
    const text = encodeURIComponent(message);
    return `https://wa.me/${phone}?text=${text}`;
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "whatsapp": return <MessageSquare className="h-4 w-4 text-emerald-500" />;
      case "email": return <Mail className="h-4 w-4 text-blue-500" />;
      case "sms": return <Phone className="h-4 w-4 text-purple-500" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const filteredCommunications = filterClient
    ? communications.filter((c) => c.client_id === filterClient)
    : communications;

  const waLink = getWhatsAppLink();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-800 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="page-title">Comunicaciones</h1>
        <p className="page-subtitle">Envia mensajes a tus clientes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="card-static">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Nuevo mensaje</h2>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cliente *</label>
              <select required value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="input-field">
                <option value="">Seleccionar cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Plantilla</label>
              <select value={selectedTemplate} onChange={(e) => handleTemplateChange(e.target.value)} className="input-field">
                <option value="">Escribir manualmente</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo</label>
              <div className="flex gap-2">
                {(["whatsapp", "email", "sms"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMessageType(type)}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border transition-all duration-200 ${
                      messageType === type
                        ? "border-blue-300 bg-blue-50 text-blue-800 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {typeIcon(type)}
                    {type === "whatsapp" ? "WhatsApp" : type === "email" ? "Email" : "SMS"}
                  </button>
                ))}
              </div>
            </div>

            {messageType === "email" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Asunto</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mensaje *</label>
              <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="input-field" />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={sending} className="btn-primary">
                <Send className="h-4 w-4" />
                {sending ? "Registrando..." : "Registrar envio"}
              </button>

              <button type="button" onClick={copyToClipboard} disabled={!message} className="btn-secondary">
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar"}
              </button>

              {messageType === "whatsapp" && waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-success">
                  <ExternalLink className="h-4 w-4" />
                  Abrir WhatsApp
                </a>
              )}
            </div>
          </form>
        </div>

        {/* History */}
        <div className="card-static">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Historial</h2>
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:border-blue-300 focus:outline-none">
                <option value="">Todos los clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredCommunications.map((comm) => (
              <div key={comm.id} className="border border-slate-100 rounded-lg p-3.5 hover:border-slate-200 hover:bg-slate-50/50 transition-all duration-150">
                <div className="flex items-center gap-2 mb-1.5">
                  {typeIcon(comm.type)}
                  <span className="text-sm font-semibold text-slate-900">{comm.client_name}</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {new Date(comm.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {comm.subject && <p className="text-xs font-medium text-slate-600 mb-1">{comm.subject}</p>}
                <p className="text-xs text-slate-500 line-clamp-3 whitespace-pre-line">{comm.message}</p>
              </div>
            ))}
            {filteredCommunications.length === 0 && (
              <div className="empty-state py-12">
                <MessageSquare className="h-12 w-12 text-slate-200 mb-3" />
                <p className="text-sm text-slate-400">
                  {filterClient ? "No hay comunicaciones con este cliente" : "No hay comunicaciones"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
