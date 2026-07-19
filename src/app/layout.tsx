import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { ToastContainer } from "@/components/Toast";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1e293b",
};

export const metadata: Metadata = {
  title: "S&H Eléctricas — Gestión eléctrica profesional",
  description: "Gestión profesional para trabajos eléctricos",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "S&H Eléctricas",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 12mm;
            }

            html,
            body,
            .app-shell,
            .app-content,
            .app-main,
            .budget-page,
            .budget-print {
              display: block !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              overflow: visible !important;
            }

            .app-main,
            .budget-page,
            .budget-print {
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            aside,
            nav,
            button,
            .no-print {
              display: none !important;
            }

            .budget-print {
              position: static !important;
              border: 0 !important;
              box-shadow: none !important;
            }

            .budget-print table {
              width: 100% !important;
              page-break-inside: auto !important;
            }

            .budget-print thead {
              display: table-header-group !important;
            }

            .budget-print tr,
            .budget-totals {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `}</style>
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased">
        <div className="app-shell flex h-[100dvh] overflow-hidden">
          <Sidebar />
          <div className="app-content flex flex-1 flex-col overflow-hidden min-w-0">
            <MobileNav />
            <main className="app-main flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
        <ToastContainer />
      </body>
    </html>
  );
}
