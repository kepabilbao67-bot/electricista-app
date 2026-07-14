"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  UserPlus,
  FileText,
  ClipboardList,
  MessageSquare,
  Calendar,
  Zap,
  Package,
  Download,
  BookOpen,
  Receipt,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/presupuestos", label: "Presupuestos", icon: ClipboardList },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/comunicaciones", label: "Comunicaciones", icon: MessageSquare },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/catalogo", label: "Servicios", icon: Package },
  { href: "/normativa", label: "Normativa", icon: BookOpen },
  { href: "/exportar", label: "Exportar", icon: Download },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-lg px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-700 to-blue-900 shadow-sm">
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 top-14 z-40 bg-slate-900/20 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute inset-x-0 top-14 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-lg shadow-xl rounded-b-2xl mx-2 animate-scale-in">
            <nav className="p-3 space-y-1">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-blue-50 text-blue-800 border border-blue-100"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${isActive ? "text-blue-700" : "text-slate-400"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}

