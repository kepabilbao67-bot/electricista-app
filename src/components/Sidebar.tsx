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
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-slate-700/80 bg-[linear-gradient(180deg,#050d17_0%,#0b1524_30%,#0d1727_100%)] shadow-[0_0_0_1px_rgba(148,163,184,0.07),20px_0_60px_rgba(2,6,23,0.6)]">
      <div className="flex h-16 items-center gap-3 border-b border-slate-700/80 bg-slate-950/20 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#f5d48a] via-[#d9b35f] to-[#9a7633] shadow-[0_10px_24px_rgba(217,179,95,0.35)] ring-1 ring-[#f5d48a]/40">
          <BrandIcon className="h-5 w-5 text-slate-950" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-slate-100">{brand.tradeName}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d9b35f]">Gestión 360°</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = resolveIcon(item.iconKey);
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-[#f5d48a]/18 via-[#d9b35f]/10 to-[#0f172a] text-slate-50 shadow-[inset_0_0_0_1px_rgba(217,179,95,0.18)]"
                  : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? "text-[#f5d48a]" : "text-slate-400 group-hover:text-[#8db9ff]"
                }`}
              />
              <span>{item.label}</span>
              {isActive && <div className="ml-auto h-2 w-2 rounded-full bg-[#f5d48a] shadow-[0_0_10px_rgba(245,212,138,0.8)]" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700/80 bg-slate-950/20 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#d9b35f] to-[#7a5a22] text-xs font-bold text-slate-950 shadow-[0_10px_20px_rgba(217,179,95,0.25)] ring-1 ring-white/10">
            {brand.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-200">{brand.ownerLabel}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              En línea
            </p>
          </div>
        </div>
      </div>
      <KaosSignature />
    </aside>
  );
}
