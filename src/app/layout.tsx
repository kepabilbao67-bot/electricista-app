import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { ToastContainer } from "@/components/Toast";
import ThemeToggle from "@/components/ThemeToggle";
import { loadVerticalConfig } from "@/lib/core/vertical-loader";
import { getActiveModules } from "@/lib/core/modules";
import { loadCompanyProfile } from "@/lib/core/company";

const verticalConfig = loadVerticalConfig();
const companyProfile = loadCompanyProfile();
const activeModules = getActiveModules(verticalConfig.modules);

const navItems = activeModules.map((m) => ({
  href: m.href,
  label: m.label,
  iconKey: m.iconKey,
}));

const sidebarBrand = {
  tradeName: verticalConfig.brand.tradeName,
  iconKey: verticalConfig.brand.iconKey,
  initials: verticalConfig.brand.initials,
  ownerLabel: companyProfile.ownerName || verticalConfig.brand.tradeName,
};

const mobileNavBrand = {
  tradeName: verticalConfig.brand.tradeName,
  iconKey: verticalConfig.brand.iconKey,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: verticalConfig.brand.themeColor,
};

export const metadata: Metadata = {
  title: `${verticalConfig.brand.tradeName} — ${verticalConfig.brand.description}`,
  description: verticalConfig.brand.description,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: verticalConfig.brand.shortName,
  },
  openGraph: {
    title: `${verticalConfig.brand.tradeName} — Software de Gestión Profesional`,
    description: verticalConfig.brand.description,
    type: "website",
    locale: "es_ES",
    siteName: verticalConfig.brand.tradeName,
  },
  twitter: {
    card: "summary_large_image",
    title: verticalConfig.brand.tradeName,
    description: verticalConfig.brand.description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('autonomo360_theme');
                  var isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 9mm;
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
              width: 100% !important;
            }

            .app-shell {
              flex-direction: column !important;
            }

            .app-main,
            .budget-page,
            .budget-print {
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

            .print-show {
              display: block !important;
            }

            .print-parte {
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              max-width: none !important;
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
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 antialiased">
        <div className="app-shell flex h-[100dvh] overflow-hidden">
          <Sidebar navItems={navItems} brand={sidebarBrand} />
          <div className="app-content flex flex-1 flex-col overflow-hidden min-w-0">
            <header className="hidden md:flex h-12 items-center justify-end px-6 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
              <ThemeToggle />
            </header>
            <MobileNav navItems={navItems} brand={mobileNavBrand} />
            <main className="app-main flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
        <ToastContainer />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.debug('SW registration skipped:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
