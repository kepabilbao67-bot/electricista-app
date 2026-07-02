"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm mb-4 animate-fade-in">
      <Link href="/" className="text-slate-400 hover:text-blue-800 transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3 text-slate-300" />
          {item.href ? (
            <Link href={item.href} className="text-slate-500 hover:text-blue-800 transition-colors font-medium">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-700 font-semibold">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
