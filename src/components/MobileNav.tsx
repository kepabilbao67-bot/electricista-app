"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { resolveIcon, type NavItemData } from "@/components/nav-icons";
import { Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

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
      <div className="flex h-14 items-center justify-between border-b border-slate-700/80 bg-slate-950/85 px-4 shadow-[0_12px_30px_rgba(2,6,23,0.5)] backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#f5d48a] via-[#d9b35f] to-[#8b6425] shadow-sm">
            <BrandIcon className="h-4 w-4 text-slate-950" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-50">{brand.tradeName}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-xl p-2 text-slate-200 transition-colors hover:bg-slate-800 active:bg-slate-700"
            aria-label="Abrir menú"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 top-14 z-40 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute inset-x-2 top-16 z-50 rounded-2xl border border-slate-700 bg-slate-900/95 p-3 shadow-[0_24px_56px_rgba(2,6,23,0.6)] animate-scale-in">
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
                        ? "bg-gradient-to-r from-[#f5d48a]/18 to-[#d9b35f]/10 text-slate-50 shadow-[inset_0_0_0_1px_rgba(217,179,95,0.15)]"
                        : "text-slate-300 hover:bg-slate-800 active:bg-slate-700"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? "text-[#f5d48a]" : "text-slate-400"}`} />
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
