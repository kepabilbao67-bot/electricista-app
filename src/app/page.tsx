"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  ClipboardList,
  Calendar,
  TrendingUp,
  Euro,
  Clock,
} from "lucide-react";

interface DashboardData {
  totalFacturacion: number;
  facturasPendientes: number;
  presupuestosPendientes: number;
  proximasVisitas: number;
  facturasEsteMes: number;
  clientesActivos: number;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  const kpis = [
    {
      label: "Facturacion total",
      value: `${(data?.totalFacturacion ?? 0).toFixed(2)} EUR`,
      icon: Euro,
      color: "bg-green-50 text-green-700",
      iconColor: "text-green-500",
    },
    {
      label: "Facturas este mes",
      value: data?.facturasEsteMes ?? 0,
      icon: FileText,
      color: "bg-blue-50 text-blue-700",
      iconColor: "text-blue-500",
    },
    {
      label: "Presupuestos pendientes",
      value: data?.presupuestosPendientes ?? 0,
      icon: ClipboardList,
      color: "bg-orange-50 text-orange-700",
      iconColor: "text-orange-500",
    },
    {
      label: "Proximas visitas",
      value: data?.proximasVisitas ?? 0,
      icon: Calendar,
      color: "bg-purple-50 text-purple-700",
      iconColor: "text-purple-500",
    },
    {
      label: "Facturas pendientes cobro",
      value: data?.facturasPendientes ?? 0,
      icon: Clock,
      color: "bg-red-50 text-red-700",
      iconColor: "text-red-500",
    },
    {
      label: "Clientes activos",
      value: data?.clientesActivos ?? 0,
      icon: TrendingUp,
      color: "bg-yellow-50 text-yellow-700",
      iconColor: "text-yellow-500",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Resumen de actividad - Ivan Martin Oyarzabal
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold mt-1">{kpi.value}</p>
              </div>
              <div className={`rounded-lg p-3 ${kpi.color}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
