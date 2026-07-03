"use client";

import { useState, useEffect } from "react";
import { Search, CheckCircle, AlertTriangle, XCircle, BookOpen, Zap, Table } from "lucide-react";
import {
  searchKnowledge,
  validateBudgetItems,
  CIRCUITS_BASIC,
  CIRCUITS_ELEVATED,
  CABLE_SECTIONS,
  ITC_DATABASE,
} from "@/lib/rebt-data";

interface Budget {
  id: string;
  number: string;
  client_name: string;
  items: Array<{ description: string }>;
}

type TabType = "consulta" | "tablas" | "validar";

export default function NormativaPage() {
  const [activeTab, setActiveTab] = useState<TabType>("consulta");
  const [query, setQuery] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [validation, setValidation] = useState<{
    valid: boolean;
    missing: string[];
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/budgets")
      .then((r) => r.json())
      .then((data) => {
        // Fetch details for each budget to get items
        const fetchDetails = data.slice(0, 20).map((b: Budget) =>
          fetch(`/api/budgets/${b.id}`).then((r) => r.json())
        );
        Promise.all(fetchDetails).then(setBudgets);
      })
      .catch(() => {});
  }, []);

  const handleSearch = () => {
    if (!query.trim()) return;
    const results = searchKnowledge(query);
    setAnswers(results);
  };

  const handleValidate = () => {
    const budget = budgets.find((b) => b.id === selectedBudgetId);
    if (!budget || !budget.items) return;
    const descriptions = budget.items.map((i) => i.description);
    const result = validateBudgetItems(descriptions);
    setValidation(result);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <Zap className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="page-title mb-0">Normativa REBT</h1>
          <p className="page-subtitle">Reglamento Electrotecnico de Baja Tension - Consulta rapida</p>
        </div>
      </div>

      {/* ITC Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        {ITC_DATABASE.map((itc) => (
          <div key={itc.code} className="card p-3">
            <p className="text-xs font-bold text-blue-700">{itc.code}</p>
            <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{itc.title}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab("consulta")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "consulta" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Search className="h-4 w-4" /> Consulta
        </button>
        <button
          onClick={() => setActiveTab("tablas")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "tablas" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Table className="h-4 w-4" /> Tablas
        </button>
        <button
          onClick={() => setActiveTab("validar")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "validar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <CheckCircle className="h-4 w-4" /> Validar presupuesto
        </button>
      </div>

      {/* Consulta Tab */}
      {activeTab === "consulta" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ej: que seccion para un horno, circuitos minimos elevada, diferencial obligatorio..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  className="input-field pl-10"
                />
              </div>
              <button onClick={handleSearch} className="btn-primary whitespace-nowrap">
                Consultar
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-slate-500">Sugerencias:</span>
              {["seccion horno", "circuitos basica", "diferencial", "tierra", "bano volumenes", "derivacion individual"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); }}
                  className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {answers.length > 0 && (
            <div className="space-y-3">
              {answers.map((answer, idx) => (
                <div key={idx} className="card border-l-4 border-l-blue-500">
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{answer}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tablas Tab */}
      {activeTab === "tablas" && (
        <div className="space-y-6">
          {/* Cable Sections */}
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Tabla de secciones de cable (ITC-BT-19)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Seccion</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Intensidad max.</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Uso tipico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CABLE_SECTIONS.map((cs) => (
                    <tr key={cs.section}>
                      <td className="px-3 py-2 font-medium text-blue-700">{cs.section}</td>
                      <td className="px-3 py-2">{cs.maxIntensity}A</td>
                      <td className="px-3 py-2 text-slate-600">{cs.typicalUse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Basic Electrification */}
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 mb-3">
              Circuitos electrificacion BASICA (5750W, IGA 25A)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Circuito</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Descripcion</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Seccion</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Proteccion</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Max puntos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CIRCUITS_BASIC.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-medium text-blue-700">{c.id}</td>
                      <td className="px-3 py-2">{c.description}</td>
                      <td className="px-3 py-2">{c.section} mm2</td>
                      <td className="px-3 py-2">{c.protection}</td>
                      <td className="px-3 py-2">{c.maxPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Elevated Electrification */}
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 mb-3">
              Circuitos electrificacion ELEVADA (9200W, IGA 40A)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Circuito</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Descripcion</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Seccion</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Proteccion</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Max puntos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CIRCUITS_ELEVATED.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-medium text-blue-700">{c.id}</td>
                      <td className="px-3 py-2">{c.description}</td>
                      <td className="px-3 py-2">{c.section} mm2</td>
                      <td className="px-3 py-2">{c.protection}</td>
                      <td className="px-3 py-2">{c.maxPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Magnetotermicos Table */}
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 mb-3">
              Magnetotermicos por circuito (ITC-BT-22)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Circuito</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Uso</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">PIA</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Conductor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CIRCUITS_BASIC.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-medium text-blue-700">{c.id}</td>
                      <td className="px-3 py-2">{c.name.replace(`${c.id} - `, "")}</td>
                      <td className="px-3 py-2 font-medium">{c.protection}</td>
                      <td className="px-3 py-2 text-slate-600">{c.conductor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Validar Tab */}
      {activeTab === "validar" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 mb-3">Validar presupuesto contra normativa</h3>
            <p className="text-sm text-slate-600 mb-4">
              Selecciona un presupuesto para verificar si cumple con los circuitos obligatorios segun ITC-BT-25.
            </p>
            <div className="flex gap-3">
              <select
                value={selectedBudgetId}
                onChange={(e) => { setSelectedBudgetId(e.target.value); setValidation(null); }}
                className="input-field flex-1"
              >
                <option value="">Seleccionar presupuesto...</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.number} - {b.client_name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleValidate}
                disabled={!selectedBudgetId}
                className="btn-primary whitespace-nowrap disabled:opacity-50"
              >
                Validar presupuesto
              </button>
            </div>
          </div>

          {validation && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                {validation.valid ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <h3 className="text-base font-semibold text-green-700">Presupuesto cumple con normativa basica</h3>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <h3 className="text-base font-semibold text-red-700">Se han detectado posibles incumplimientos</h3>
                  </>
                )}
              </div>

              {validation.missing.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-red-700 mb-2">Circuitos obligatorios no detectados:</p>
                  <div className="space-y-1">
                    {validation.missing.map((m) => (
                      <div key={m} className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        <XCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validation.warnings.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-amber-700 mb-2">Advertencias:</p>
                  <div className="space-y-1">
                    {validation.warnings.map((w) => (
                      <div key={w} className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validation.valid && (
                <p className="text-sm text-green-600">
                  Todos los circuitos obligatorios y protecciones parecen estar incluidos en el presupuesto.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
