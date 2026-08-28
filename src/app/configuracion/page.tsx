"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  Receipt,
  CreditCard,
  Save,
  CheckCircle2,
  Sliders,
  FileText,
  Phone,
  Mail,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { showToast } from "@/components/Toast";
import type { CompanySettingsPayload } from "@/app/api/settings/route";

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [formData, setFormData] = useState<CompanySettingsPayload>({
    trade_name: "",
    legal_name: "",
    owner_name: "",
    nif: "",
    address_line1: "",
    address_line2: "",
    phone: "",
    email: "",
    iban: "",
    bank_name: "",
    invoice_series_prefix: "FAC-",
    budget_series_prefix: "PRES-",
    work_order_series_prefix: "PT-",
    default_tax_rate: 21,
    theme_color: "#2563eb",
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setFormData({
          trade_name: data.trade_name || "",
          legal_name: data.legal_name || "",
          owner_name: data.owner_name || "",
          nif: data.nif || "",
          address_line1: data.address_line1 || "",
          address_line2: data.address_line2 || "",
          phone: data.phone || "",
          email: data.email || "",
          iban: data.iban || "",
          bank_name: data.bank_name || "",
          invoice_series_prefix: data.invoice_series_prefix || "FAC-",
          budget_series_prefix: data.budget_series_prefix || "PRES-",
          work_order_series_prefix: data.work_order_series_prefix || "PT-",
          default_tax_rate: Number(data.default_tax_rate) || 21,
          theme_color: data.theme_color || "#2563eb",
        });
      })
      .catch(() => {
        showToast("error", "No se pudo cargar la configuración.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Error al guardar");

      showToast("success", "Configuración guardada exitosamente");
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      showToast("error", "Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      <Breadcrumbs items={[{ label: "Configuración", href: "/configuracion" }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Sliders className="h-6 w-6 text-blue-600" />
            Configuración del Negocio
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Personaliza la identidad visual, datos fiscales, bancarios y series de facturación de tu plataforma SaaS.
          </p>
        </div>

        <Button
          onClick={handleSave}
          loading={saving}
          icon={savedSuccess ? CheckCircle2 : Save}
          variant={savedSuccess ? "success" : "primary"}
          className="shrink-0"
        >
          {savedSuccess ? "Guardado" : "Guardar cambios"}
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Grid de Secciones */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda / Principal: Formulario */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Datos de Empresa */}
            <Card title="Identidad de Empresa" icon={Building2} padding="md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nombre comercial
                  </label>
                  <input
                    type="text"
                    name="trade_name"
                    value={formData.trade_name || ""}
                    onChange={handleChange}
                    placeholder="Ej: Instalaciones Eléctricas Pro"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Razón Social / Titular
                  </label>
                  <input
                    type="text"
                    name="legal_name"
                    value={formData.legal_name || ""}
                    onChange={handleChange}
                    placeholder="Ej: Instalaciones Eléctricas Pro, S.L."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Responsable / Administrador
                  </label>
                  <input
                    type="text"
                    name="owner_name"
                    value={formData.owner_name || ""}
                    onChange={handleChange}
                    placeholder="Ej: Juan Pérez Gómez"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    NIF / CIF
                  </label>
                  <input
                    type="text"
                    name="nif"
                    value={formData.nif || ""}
                    onChange={handleChange}
                    placeholder="Ej: B12345678"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </Card>

            {/* 2. Dirección y Contacto */}
            <Card title="Dirección y Contacto" icon={MapPin} padding="md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Dirección principal (Calle, número, piso)
                  </label>
                  <input
                    type="text"
                    name="address_line1"
                    value={formData.address_line1 || ""}
                    onChange={handleChange}
                    placeholder="Ej: Calle Gran Vía 28, 3º D"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Código Postal y Ciudad / Provincia
                  </label>
                  <input
                    type="text"
                    name="address_line2"
                    value={formData.address_line2 || ""}
                    onChange={handleChange}
                    placeholder="Ej: 28013 Madrid"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Teléfono de atención
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone || ""}
                      onChange={handleChange}
                      placeholder="+34 600 000 000"
                      className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email de facturación y contacto
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email || ""}
                      onChange={handleChange}
                      placeholder="facturacion@miempresa.com"
                      className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* 3. Datos Bancarios */}
            <Card title="Datos Bancarios para Cobros" icon={CreditCard} padding="md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Entidad Bancaria
                  </label>
                  <input
                    type="text"
                    name="bank_name"
                    value={formData.bank_name || ""}
                    onChange={handleChange}
                    placeholder="Ej: Santander, BBVA, CaixaBank"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    IBAN Completo
                  </label>
                  <input
                    type="text"
                    name="iban"
                    value={formData.iban || ""}
                    onChange={handleChange}
                    placeholder="ES00 0000 0000 0000 0000 0000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </Card>

            {/* 4. Series de Documentos y Facturación */}
            <Card title="Series de Documentos & Impuestos" icon={Receipt} padding="md">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Serie de Facturas
                  </label>
                  <input
                    type="text"
                    name="invoice_series_prefix"
                    value={formData.invoice_series_prefix || ""}
                    onChange={handleChange}
                    placeholder="FAC-"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Serie Presupuestos
                  </label>
                  <input
                    type="text"
                    name="budget_series_prefix"
                    value={formData.budget_series_prefix || ""}
                    onChange={handleChange}
                    placeholder="PRES-"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    IVA por defecto (%)
                  </label>
                  <input
                    type="number"
                    name="default_tax_rate"
                    value={formData.default_tax_rate ?? 21}
                    onChange={handleChange}
                    min={0}
                    max={100}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Columna Derecha: Vista Previa en Vivo */}
          <div className="space-y-6">
            <Card title="Vista Previa de Documento" icon={FileText} variant="gradient" padding="md">
              <div className="space-y-4 text-xs">
                <p className="text-slate-500">
                  Así aparecerán los datos en la cabecera de tus presupuestos, partes y facturas emitidas:
                </p>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-2">
                  <div className="border-b border-slate-100 pb-2">
                    <p className="font-bold text-sm text-slate-900">
                      {formData.legal_name || "Nombre o Razón Social"}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px]">
                      NIF: {formData.nif || "B00000000"}
                    </p>
                  </div>

                  <p className="text-slate-600">
                    {formData.address_line1 || "Dirección de la empresa"}
                  </p>
                  {formData.address_line2 && (
                    <p className="text-slate-600">{formData.address_line2}</p>
                  )}

                  <div className="pt-2 border-t border-slate-100 text-slate-500 space-y-0.5">
                    <p>Tel: {formData.phone || "+34 600 000 000"}</p>
                    <p>Email: {formData.email || "info@miempresa.com"}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[11px]">
                    <span className="font-semibold text-slate-700">Cuenta de pago:</span>
                    <p className="font-mono text-slate-600 mt-0.5">
                      {formData.bank_name ? `${formData.bank_name}: ` : ""}
                      {formData.iban || "ES00 0000 0000 0000 0000 0000"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-blue-50/70 border border-blue-200/60 p-3 text-[11px] text-blue-800 flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    Los cambios se guardan de forma segura en base de datos y se reflejan de inmediato en todas las secciones.
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                loading={saving}
                icon={savedSuccess ? CheckCircle2 : Save}
                variant={savedSuccess ? "success" : "primary"}
                className="w-full shadow-lg"
              >
                {savedSuccess ? "Guardado" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
