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
    <aside className="hidden md:flex md:w-64 md:flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 border-r border-slate-700/30">
      {/* Brand Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-700/40">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg shadow-blue-900/40 ring-1 ring-blue-500/20">
          <BrandIcon className="h-5 w-5 text-amber-400" />
        </div>
        <span className="text-sm font-bold text-slate-200 tracking-tight">{brand.tradeName}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = resolveIcon(item.iconKey);
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-blue-800/30 text-blue-200 shadow-sm border border-blue-700/30"
                  : "text-slate-400 hover:bg-slate-700/40 hover:text-slate-200"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] transition-colors ${isActive ? "text-amber-400" : "text-slate-500 group-hover:text-slate-300"}`} />
              {item.label}
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="border-t border-slate-700/40 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 to-blue-900 text-xs font-bold text-blue-200 ring-1 ring-blue-600/30">
            {brand.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-300 truncate">{brand.ownerLabel}</p>
            <p className="text-[10px] text-slate-500">{brand.tradeName}</p>
          </div>
        </div>
      </div>
      <KaosSignature />
    </aside>
  );
}
