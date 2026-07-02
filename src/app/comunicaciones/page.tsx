"use client";

import { useEffect, useState } from "react";
import { Send, MessageSquare, Mail, Phone } from "lucide-react";
import { templates } from "@/lib/templates";

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface Communication {
  id: string;
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
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [messageType, setMessageType] = useState<"whatsapp" | "email" | "sms">("whatsapp");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then(setClients);
    fetch("/api/communications").then((r) => r.json()).then(setCommunications);
  }, []);

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
      setMessage("");
      setSubject("");
      setSelectedTemplate("");
      fetch("/api/communications").then((r) => r.json()).then(setCommunications);
    }
    setSending(false);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "whatsapp":
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "email":
        return <Mail className="h-4 w-4 text-blue-500" />;
      case "sms":
        return <Phone className="h-4 w-4 text-purple-500" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Comunicaciones</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Nuevo mensaje</h2>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
              <select
                required
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
              >
                <option value="">Seleccionar cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla</label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
              >
                <option value="">Escribir manualmente</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <div className="flex gap-3">
                {(["whatsapp", "email", "sms"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMessageType(type)}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                      messageType === type
                        ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje *</label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? "Enviando..." : "Enviar"}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Historial</h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {communications.map((comm) => (
              <div key={comm.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  {typeIcon(comm.type)}
                  <span className="text-sm font-medium">{comm.client_name}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(comm.created_at).toLocaleDateString("es-ES")}
                  </span>
                </div>
                {comm.subject && (
                  <p className="text-xs font-medium text-gray-600 mb-1">{comm.subject}</p>
                )}
                <p className="text-xs text-gray-500 line-clamp-3">{comm.message}</p>
              </div>
            ))}
            {communications.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No hay comunicaciones</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
