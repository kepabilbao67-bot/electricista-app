"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { resolveIcon, type NavItemData } from "@/components/nav-icons";
import { Menu, X } from "lucide-react";

export interface MobileNavProps {
  navItems: NavItemData[];
  brand: {
    tradeName: string;
    iconKey: string;
  };
}

export function MobileNav({ navItems, brand }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const BrandIcon = resolveIcon(brand.iconKey);

  return (
    <div className="md:hidden sticky top-0 z-40">
      <div className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 shadow-sm">
            <BrandIcon className="h-4 w-4 text-amber-400" />
          </div>
          <span className="text-sm font-bold text-slate-900 tracking-tight">{brand.tradeName}</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-xl p-2 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors"
          aria-label="Abrir menú"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 top-14 z-40 bg-slate-950/40 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute inset-x-2 top-16 z-50 border border-slate-200/80 bg-white/98 backdrop-blur-xl shadow-2xl rounded-2xl p-3 animate-scale-in">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = resolveIcon(item.iconKey);
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md shadow-blue-500/20"
                        : "text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? "text-amber-300" : "text-slate-500"}`} />
                    <span>{item.label}</span>
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
