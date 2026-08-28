"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KaosSignature } from "@/components/KaosSignature";
import { resolveIcon, type NavItemData } from "@/components/nav-icons";

export type { NavItemData };

export interface SidebarProps {
  navItems: NavItemData[];
  brand: {
    tradeName: string;
    iconKey: string;
    initials: string;
    ownerLabel: string;
  };
}

export function Sidebar({ navItems, brand }: SidebarProps) {
  const pathname = usePathname();
  const BrandIcon = resolveIcon(brand.iconKey);

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-r border-slate-800/80 shadow-2xl">
      {/* Brand Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 shadow-md shadow-blue-900/50 ring-1 ring-blue-400/30">
          <BrandIcon className="h-5 w-5 text-amber-400 animate-pulse" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-100 tracking-tight leading-none">{brand.tradeName}</span>
          <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest mt-1">Gestión 360°</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = resolveIcon(item.iconKey);
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 group relative ${
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 font-semibold"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-amber-300" : "text-slate-400 group-hover:text-blue-400"}`} />
              <span>{item.label}</span>
              {isActive && (
                <div className="ml-auto h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="border-t border-slate-800/80 p-4 bg-slate-950/30">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 text-xs font-bold text-white shadow-md ring-1 ring-white/10">
            {brand.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-200 truncate">{brand.ownerLabel}</p>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              En línea
            </p>
          </div>
        </div>
      </div>
      <KaosSignature />
    </aside>
  );
}
