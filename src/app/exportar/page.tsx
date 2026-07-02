"use client";

import { Download, FileSpreadsheet, Database, Upload, ExternalLink } from "lucide-react";

export default function ExportarPage() {
  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Exportar y sincronizar</h1>
        <p className="text-slate-500 mt-1">Descarga tus datos en CSV (compatible con Excel, Google Sheets, Airtable)</p>
      </div>

      {/* Exportar CSV */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Clientes</h3>
              <p className="text-sm text-slate-500 mt-1">Nombre, NIF, telefono, email, direccion</p>
              <a
                href="/api/export/clients"
                className="inline-flex items-center gap-2 mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Descargar CSV
              </a>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
              <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Facturas</h3>
              <p className="text-sm text-slate-500 mt-1">Numero, fecha, cliente, importes, estado, TicketBAI</p>
              <a
                href="/api/export/invoices"
                className="inline-flex items-center gap-2 mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Descargar CSV
              </a>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
              <FileSpreadsheet className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Presupuestos</h3>
              <p className="text-sm text-slate-500 mt-1">Numero, fecha, cliente, importes, estado, validez</p>
              <a
                href="/api/export/budgets"
                className="inline-flex items-center gap-2 mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Descargar CSV
              </a>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <Database className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Backup completo</h3>
              <p className="text-sm text-slate-500 mt-1">Todos los datos en JSON (clientes, facturas, presupuestos, catalogo)</p>
              <a
                href="/api/export/all"
                className="inline-flex items-center gap-2 mt-3 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Descargar JSON
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Importar a herramientas */}
      <div className="card border-indigo-100 bg-gradient-to-br from-indigo-50/30 to-white">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
            <Upload className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Importar en Google Sheets / Airtable</h2>
            <p className="text-sm text-slate-500">Usa los CSV descargados para tener tus datos en la nube</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">1</span>
              Google Sheets (gratis)
            </h3>
            <ol className="text-sm text-slate-600 space-y-1.5 ml-8">
              <li>1. Descarga el CSV que quieras</li>
              <li>2. Abre <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">sheets.google.com <ExternalLink className="h-3 w-3" /></a></li>
              <li>3. Archivo → Importar → Subir → Selecciona el CSV</li>
              <li>4. Separador: punto y coma (;)</li>
              <li>5. Ya tienes todos tus datos en Google Sheets</li>
            </ol>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">2</span>
              Airtable
            </h3>
            <ol className="text-sm text-slate-600 space-y-1.5 ml-8">
              <li>1. Descarga el CSV</li>
              <li>2. Abre <a href="https://airtable.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">airtable.com <ExternalLink className="h-3 w-3" /></a> (cuenta gratis)</li>
              <li>3. Crea una base nueva → Import → CSV file</li>
              <li>4. Selecciona el CSV descargado</li>
              <li>5. Airtable crea las columnas automaticamente</li>
            </ol>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">3</span>
              Excel (en tu ordenador)
            </h3>
            <ol className="text-sm text-slate-600 space-y-1.5 ml-8">
              <li>1. Descarga el CSV</li>
              <li>2. Haz doble click en el archivo</li>
              <li>3. Se abre directamente en Excel</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Tip */}
      <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-sm text-amber-800">
          <strong>Tip:</strong> Descarga el CSV regularmente para tener una copia de seguridad de tus datos. 
          El backup JSON contiene TODOS los datos y puedes usarlo para restaurar la app si es necesario.
        </p>
      </div>
    </div>
  );
}
