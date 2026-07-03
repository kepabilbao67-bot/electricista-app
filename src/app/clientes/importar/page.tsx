"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileSpreadsheet, ClipboardPaste, CheckCircle, AlertCircle } from "lucide-react";
import { showToast } from "@/components/Toast";

interface ImportResult {
  success: boolean;
  created: number;
  skipped: number;
  total: number;
  errors?: string[];
}

export default function ImportarClientesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"csv" | "paste">("csv");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const parseCSV = (text: string) => {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return [];

    // Detect separator (; or ,)
    const separator = lines[0].includes(";") ? ";" : ",";

    // First line is header
    const headers = lines[0].split(separator).map((h) => h.replace(/"/g, "").trim().toLowerCase());

    const clients = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map((v) => v.replace(/"/g, "").trim());
      const client: Record<string, string> = {};

      headers.forEach((header, index) => {
        const value = values[index] || "";
        // Map common header names
        if (header.includes("nombre") || header.includes("name") || header === "cliente") {
          client.name = value;
        } else if (header.includes("nif") || header.includes("cif") || header.includes("dni")) {
          client.nif = value;
        } else if (header.includes("telefono") || header.includes("phone") || header.includes("tel") || header.includes("movil")) {
          client.phone = value;
        } else if (header.includes("email") || header.includes("correo") || header.includes("mail")) {
          client.email = value;
        } else if (header.includes("direccion") || header.includes("address") || header.includes("calle")) {
          client.address = value;
        } else if (header.includes("ciudad") || header.includes("city") || header.includes("localidad") || header.includes("municipio")) {
          client.city = value;
        } else if (header.includes("codigo postal") || header.includes("postal") || header.includes("cp")) {
          client.postal_code = value;
        } else if (header.includes("provincia") || header.includes("province")) {
          client.province = value;
        } else if (header.includes("nota") || header.includes("notes") || header.includes("observ")) {
          client.notes = value;
        }
      });

      if (client.name) {
        clients.push(client);
      }
    }

    return clients;
  };

  const parsePasteText = (text: string) => {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const clients = [];

    for (const line of lines) {
      // Try to parse different formats:
      // "Nombre;NIF;Telefono;Email;Direccion;Ciudad;Provincia"
      // "Nombre - Telefono"
      // "Nombre (NIF)"
      // Just "Nombre"

      const separator = line.includes(";") ? ";" : line.includes("\t") ? "\t" : null;

      if (separator) {
        const parts = line.split(separator).map((p) => p.trim());
        clients.push({
          name: parts[0] || "",
          nif: parts[1] || "",
          phone: parts[2] || "",
          email: parts[3] || "",
          address: parts[4] || "",
          city: parts[5] || "",
          province: parts[6] || "",
        });
      } else {
        // Try "Nombre - Telefono" or "Nombre (NIF)"
        const nifMatch = line.match(/^(.+?)\s*\(([A-Z0-9]+)\)\s*$/);
        const phoneMatch = line.match(/^(.+?)\s*[-–]\s*([\d\s+]+)\s*$/);

        if (nifMatch) {
          clients.push({ name: nifMatch[1].trim(), nif: nifMatch[2].trim() });
        } else if (phoneMatch) {
          clients.push({ name: phoneMatch[1].trim(), phone: phoneMatch[2].trim() });
        } else {
          clients.push({ name: line });
        }
      }
    }

    return clients.filter((c) => c.name);
  };

  const handleCSVUpload = async () => {
    if (!csvFile) return;
    setImporting(true);
    setResult(null);

    try {
      const text = await csvFile.text();
      const clients = parseCSV(text);

      if (clients.length === 0) {
        showToast("error", "No se encontraron clientes en el archivo");
        setImporting(false);
        return;
      }

      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients }),
      });

      const data = await res.json();
      setResult(data);
      if (data.created > 0) showToast("success", `${data.created} clientes importados`);
    } catch {
      showToast("error", "Error al procesar el archivo");
    }
    setImporting(false);
  };

  const handlePasteImport = async () => {
    if (!pasteText.trim()) return;
    setImporting(true);
    setResult(null);

    try {
      const clients = parsePasteText(pasteText);

      if (clients.length === 0) {
        showToast("error", "No se encontraron clientes en el texto");
        setImporting(false);
        return;
      }

      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients }),
      });

      const data = await res.json();
      setResult(data);
      if (data.created > 0) showToast("success", `${data.created} clientes importados`);
    } catch {
      showToast("error", "Error al procesar el texto");
    }
    setImporting(false);
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Importar clientes</h1>
          <p className="text-sm text-slate-500">Carga clientes desde un archivo CSV o pegando una lista</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setTab("csv")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === "csv" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Subir CSV/Excel
        </button>
        <button
          onClick={() => setTab("paste")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === "paste" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          <ClipboardPaste className="h-4 w-4" />
          Copiar y pegar
        </button>
      </div>

      {/* CSV Tab */}
      {tab === "csv" && (
        <div className="card">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Subir archivo CSV</h2>
          <p className="text-sm text-slate-500 mb-4">
            El CSV debe tener una primera fila con los nombres de las columnas. Se reconocen automaticamente:
            Nombre, NIF, Telefono, Email, Direccion, Ciudad, Codigo Postal, Provincia
          </p>

          <div className="bg-slate-50 rounded-lg border border-slate-200 p-6 mb-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Ejemplo de formato CSV:</p>
            <pre className="text-xs font-mono text-slate-600 bg-white p-3 rounded border border-slate-200 overflow-x-auto">
{`Nombre;NIF;Telefono;Email;Direccion;Ciudad;Provincia
NERPAL2.005 SL;B95364469;944123456;info@nerpal.com;C/Derio Bidea 55;MUNGUIA;BIZKAIA
Juan Perez;12345678A;688123456;juan@email.com;Calle Mayor 5;BARAKALDO;BIZKAIA
Comunidad Portal 7;;;944555666;;PORTUGALETE;BIZKAIA`}
            </pre>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".csv,.txt,.xls,.xlsx"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              className="flex-1 text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <button
              onClick={handleCSVUpload}
              disabled={!csvFile || importing}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importando..." : "Importar"}
            </button>
          </div>
        </div>
      )}

      {/* Paste Tab */}
      {tab === "paste" && (
        <div className="card">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Pegar lista de clientes</h2>
          <p className="text-sm text-slate-500 mb-4">
            Pega tus clientes, uno por linea. Formatos aceptados:
          </p>

          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 mb-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Formatos validos:</p>
            <pre className="text-xs font-mono text-slate-600 bg-white p-3 rounded border border-slate-200">
{`Nombre;NIF;Telefono;Email;Direccion;Ciudad;Provincia
Nombre - Telefono
Nombre (NIF)
Solo el nombre del cliente`}
            </pre>
          </div>

          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={10}
            placeholder={`Pega aqui tus clientes, uno por linea. Ejemplos:

NERPAL2.005 SL;B95364469;944123456
Comunidad Portal 7 - 688123456
Juan Perez (12345678A)
Maria Lopez`}
            className="input-field font-mono text-sm mb-4"
          />

          <button
            onClick={handlePasteImport}
            disabled={!pasteText.trim() || importing}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            <Upload className="h-4 w-4" />
            {importing ? "Importando..." : `Importar clientes`}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`card mt-6 ${result.created > 0 ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
          <div className="flex items-start gap-3">
            {result.created > 0 ? (
              <CheckCircle className="h-6 w-6 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-600 mt-0.5" />
            )}
            <div>
              <h3 className="font-semibold text-slate-900">Resultado de la importacion</h3>
              <div className="mt-2 space-y-1 text-sm">
                <p className="text-emerald-700"><strong>{result.created}</strong> clientes creados</p>
                {result.skipped > 0 && (
                  <p className="text-amber-700"><strong>{result.skipped}</strong> omitidos (ya existian o sin nombre)</p>
                )}
                <p className="text-slate-500">Total procesados: {result.total}</p>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-3 p-3 bg-white rounded border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Detalles:</p>
                  <ul className="text-xs text-slate-600 space-y-0.5">
                    {result.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={() => router.push("/clientes")}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Ver clientes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
