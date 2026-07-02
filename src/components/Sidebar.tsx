"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardList,
  MessageSquare,
  Calendar,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/presupuestos", label: "Presupuestos", icon: ClipboardList },
  { href: "/comunicaciones", label: "Comunicaciones", icon: MessageSquare },
  { href: "/agenda", label: "Agenda", icon: Calendar },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-gray-900 text-white">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-gray-700">
        <Zap className="h-6 w-6 text-yellow-400" />
        <span className="text-lg font-bold">Electricista</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-700 p-4">
        <p className="text-xs text-gray-400">Ivan Martin Oyarzabal</p>
        <p className="text-xs text-gray-500">NIF: 16063731W</p>
      </div>
    </aside>
  );
}
