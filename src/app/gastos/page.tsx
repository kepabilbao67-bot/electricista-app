"use client";

import { useEffect, useState } from "react";
import { Plus, Receipt, TrendingDown, Search } from "lucide-react";
import { showToast } from "@/components/Toast";

interface Expense {
  id: string;
  supplier_name: string;
  invoice_number: string;
  date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  obra: string;
  albaran: string;
}

interface ExpenseItem {
  article_code: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-50 text-amber-700 border border-amber-200" },
  paid: { label: "Pagada", color: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
};

export default function GastosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [supplierName, setSupplierName] = useState("");
  const [supplierNif, setSupplierNif] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [obra, setObra] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ExpenseItem[]>([
    { article_code: "", description: "", quantity: 1, unit_price: 0, discount: 0 },
  ]);

  useEffect(() => {
    fetch("/api/expenses").then((r) => r.json()).then((data) => {
      setExpenses(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const addItem = () => {
    setItems([...items, { article_code: "", description: "", quantity: 1, unit_price: 0, discount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const subtotal = items.reduce((acc, item) => acc + item.quantity * item.unit_price * (1 - item.discount / 100), 0);
  const taxAmount = subtotal * 0.21;
  const total = subtotal + taxAmount;

  const totalGastos = expenses.reduce((acc, e) => acc + (e.total || 0), 0);
  const gastosPendientes = expenses.filter((e) => e.status === "pending").reduce((acc, e) => acc + (e.total || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName) return;
    setSubmitting(true);

    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier_name: supplierName,
        supplier_nif: supplierNif,
        invoice_number: invoiceNumber,
        date, due_date: dueDate, obra, notes,
        items: items.filter((i) => i.description && i.unit_price > 0),
      }),
    });

    if (res.ok) {
      const expense = await res.json();
      setExpenses([expense, ...expenses]);
      showToast("success", "Factura de compra registrada");
      setShowForm(false);
      resetForm();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setSupplierName(""); setSupplierNif(""); setInvoiceNumber("");
    setDate(new Date().toISOString().split("T")[0]); setDueDate("");
    setObra(""); setNotes("");
    setItems([{ article_code: "", description: "", quantity: 1, unit_price: 0, discount: 0 }]);
  };

  const markPaid = async (id: string) => {
    await fetch(`/api/expenses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    setExpenses(expenses.map((e) => e.id === id ? { ...e, status: "paid" } : e));
    showToast("success", "Gasto marcado como pagado");
  };

  const filtered = expenses.filter((e) =>
    (e.supplier_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.invoice_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.obra || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gastos / Compras</h1>
          <p className="text-sm text-slate-500">Facturas de proveedores y material</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Nueva compra
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
            <TrendingDown className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total gastos</p>
            <p className="text-xl font-bold text-slate-900">{totalGastos.toFixed(2)} EUR</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
            <Receipt className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Pendientes pago</p>
            <p className="text-xl font-bold text-amber-700">{gastosPendientes.toFixed(2)} EUR</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <Receipt className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Facturas registradas</p>
            <p className="text-xl font-bold text-slate-900">{expenses.length}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-6 border-indigo-200 bg-indigo-50/30">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Registrar factura de compra</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Proveedor *</label>
                <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Ej: SOKOEL S.A." className="input-field" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">NIF Proveedor</label>
                <input type="text" value={supplierNif} onChange={(e) => setSupplierNif(e.target.value)} placeholder="A48731400" className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nº Factura</label>
                <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="933739" className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fecha</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Vencimiento</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Obra</label>
                <input type="text" value={obra} onChange={(e) => setObra(e.target.value)} placeholder="Nombre de la obra" className="input-field" />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-700">Lineas de material</label>
                <button type="button" onClick={addItem} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Linea</button>
              </div>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input type="text" placeholder="Codigo" value={item.article_code} onChange={(e) => updateItem(index, "article_code", e.target.value)} className="input-field w-28 !py-1.5 text-xs" />
                    <input type="text" placeholder="Descripcion" value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} className="input-field flex-1 !py-1.5 text-xs" />
                    <input type="number" min="0.01" step="0.01" placeholder="Cant" value={item.quantity || ""} onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)} className="input-field w-16 !py-1.5 text-xs text-center" />
                    <input type="number" min="0" step="0.01" placeholder="Precio" value={item.unit_price || ""} onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)} className="input-field w-20 !py-1.5 text-xs text-center" />
                    <input type="number" min="0" max="100" step="1" placeholder="Dto%" value={item.discount || ""} onChange={(e) => updateItem(index, "discount", parseFloat(e.target.value) || 0)} className="input-field w-16 !py-1.5 text-xs text-center" />
                    <span className="text-xs font-medium text-slate-600 w-20 text-right">{(item.quantity * item.unit_price * (1 - item.discount / 100)).toFixed(2)}€</span>
                    <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <div className="text-right mt-3 space-y-0.5">
                <p className="text-sm text-slate-500">Subtotal: {subtotal.toFixed(2)} EUR</p>
                <p className="text-sm text-slate-500">IVA 21%: {taxAmount.toFixed(2)} EUR</p>
                <p className="text-lg font-bold text-slate-900">Total: {total.toFixed(2)} EUR</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary">{submitting ? "Guardando..." : "Registrar compra"}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Buscar por proveedor, nº factura u obra..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field !pl-10" />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No hay gastos registrados</p>
            <p className="text-sm text-slate-400">Registra tus facturas de proveedores para controlar los costes</p>
          </div>
        ) : (
          filtered.map((expense) => {
            const status = statusLabels[expense.status] || statusLabels.pending;
            return (
              <div key={expense.id} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{expense.supplier_name || "Sin proveedor"}</p>
                    {expense.invoice_number && <span className="text-xs text-slate-400">Nº {expense.invoice_number}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{expense.date}</span>
                    {expense.obra && <span>Obra: {expense.obra}</span>}
                    {expense.due_date && <span>Vto: {expense.due_date}</span>}
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span>
                <p className="text-lg font-bold text-slate-900 w-28 text-right">{(expense.total || 0).toFixed(2)} €</p>
                {expense.status === "pending" && (
                  <button onClick={() => markPaid(expense.id)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Pagada</button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
