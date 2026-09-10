import Link from "next/link";

export default function CatalogoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Catálogos">
        <Link
          href="/catalogo"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Catálogo general
        </Link>
        <Link
          href="/catalogo/sokoel"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          SOKOEL · 32 productos
        </Link>
      </nav>
      {children}
    </div>
  );
}
