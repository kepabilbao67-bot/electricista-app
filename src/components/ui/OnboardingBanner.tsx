import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, UserPlus, ClipboardList, CheckCircle2, X } from "lucide-react";

export interface OnboardingBannerProps {
  ownerName?: string;
  hasClients: boolean;
  hasBudgets: boolean;
}

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({
  ownerName = "Profesional",
  hasClients,
  hasBudgets,
}) => {
  const [dismissed, setDismissed] = useState(false);

  // Si ya tiene clientes y presupuestos, o el usuario lo cerró, no mostrarlo
  if (dismissed || (hasClients && hasBudgets)) {
    return null;
  }

  const steps = [
    {
      id: 1,
      title: "1. Añade tu primer cliente",
      desc: "Guarda los datos de contacto y facturación.",
      href: "/clientes",
      icon: UserPlus,
      completed: hasClients,
    },
    {
      id: 2,
      title: "2. Genera un presupuesto",
      desc: "Crea un desglose automático o manual con REBT.",
      href: "/presupuestos/nuevo",
      icon: ClipboardList,
      completed: hasBudgets,
    },
    {
      id: 3,
      title: "3. Convierte a Parte o Factura",
      desc: "Emisión ágil con cálculo automático y TicketBAI.",
      href: "/facturas",
      icon: CheckCircle2,
      completed: false,
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 p-6 md:p-8 text-white shadow-xl shadow-blue-950/20 mb-8 animate-fade-in">
      <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        title="Ocultar guía"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-3 mb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="text-xl font-bold tracking-tight text-white">
          ¡Bienvenido a Autónomo 360, {ownerName}!
        </h2>
      </div>
      
      <p className="text-sm text-blue-200/90 max-w-2xl mb-6">
        Sigue estos 3 sencillos pasos para tener tu gestión comercial y operativa completamente sincronizada.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.id}
              href={step.href}
              className={`group flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 ${
                step.completed
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-100"
                  : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-blue-400/40 text-white"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-2 rounded-lg ${step.completed ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-300"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {step.completed && (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Listo
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-blue-200/70">{step.desc}</p>
              </div>
              <div className="mt-4 flex items-center text-xs font-semibold text-blue-300 group-hover:text-white transition-colors">
                Comenzar <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
