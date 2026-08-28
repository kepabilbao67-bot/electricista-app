import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { getAppConfig, AppConfig } from "@/config/app-config";

export interface CompanySettingsPayload {
  trade_name?: string;
  legal_name?: string;
  owner_name?: string;
  nif?: string;
  address_line1?: string;
  address_line2?: string;
  phone?: string;
  email?: string;
  iban?: string;
  bank_name?: string;
  invoice_series_prefix?: string;
  budget_series_prefix?: string;
  work_order_series_prefix?: string;
  default_tax_rate?: number;
  theme_color?: string;
}

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const result = await db.execute({
      sql: "SELECT * FROM company_settings WHERE id = 'default' LIMIT 1",
      args: [],
    });

    const defaultConfig = getAppConfig();

    if (result.rows.length === 0) {
      return NextResponse.json({
        trade_name: defaultConfig.company.tradeName,
        legal_name: defaultConfig.company.legalName,
        owner_name: defaultConfig.company.ownerName,
        nif: defaultConfig.company.nif,
        address_line1: defaultConfig.company.addressLine1,
        address_line2: defaultConfig.company.addressLine2,
        phone: defaultConfig.company.phone,
        email: defaultConfig.company.email,
        iban: defaultConfig.company.iban,
        bank_name: defaultConfig.company.bankName,
        invoice_series_prefix: defaultConfig.billing.invoiceSeriesPrefix,
        budget_series_prefix: defaultConfig.billing.budgetSeriesPrefix,
        work_order_series_prefix: defaultConfig.billing.workOrderSeriesPrefix,
        default_tax_rate: defaultConfig.billing.defaultTaxRate,
        theme_color: defaultConfig.app.themeColor,
      });
    }

    const row = result.rows[0];
    return NextResponse.json({
      trade_name: row.trade_name || defaultConfig.company.tradeName,
      legal_name: row.legal_name || defaultConfig.company.legalName,
      owner_name: row.owner_name || defaultConfig.company.ownerName,
      nif: row.nif || defaultConfig.company.nif,
      address_line1: row.address_line1 || defaultConfig.company.addressLine1,
      address_line2: row.address_line2 || defaultConfig.company.addressLine2,
      phone: row.phone || defaultConfig.company.phone,
      email: row.email || defaultConfig.company.email,
      iban: row.iban || defaultConfig.company.iban,
      bank_name: row.bank_name || defaultConfig.company.bankName,
      invoice_series_prefix: row.invoice_series_prefix || defaultConfig.billing.invoiceSeriesPrefix,
      budget_series_prefix: row.budget_series_prefix || defaultConfig.billing.budgetSeriesPrefix,
      work_order_series_prefix: row.work_order_series_prefix || defaultConfig.billing.workOrderSeriesPrefix,
      default_tax_rate: Number(row.default_tax_rate) || defaultConfig.billing.defaultTaxRate,
      theme_color: row.theme_color || defaultConfig.app.themeColor,
    });
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body: CompanySettingsPayload = await request.json();

    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO company_settings (
        id, trade_name, legal_name, owner_name, nif, address_line1, address_line2,
        phone, email, iban, bank_name, invoice_series_prefix, budget_series_prefix,
        work_order_series_prefix, default_tax_rate, theme_color, updated_at
      ) VALUES (
        'default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      ) ON CONFLICT(id) DO UPDATE SET
        trade_name = excluded.trade_name,
        legal_name = excluded.legal_name,
        owner_name = excluded.owner_name,
        nif = excluded.nif,
        address_line1 = excluded.address_line1,
        address_line2 = excluded.address_line2,
        phone = excluded.phone,
        email = excluded.email,
        iban = excluded.iban,
        bank_name = excluded.bank_name,
        invoice_series_prefix = excluded.invoice_series_prefix,
        budget_series_prefix = excluded.budget_series_prefix,
        work_order_series_prefix = excluded.work_order_series_prefix,
        default_tax_rate = excluded.default_tax_rate,
        theme_color = excluded.theme_color,
        updated_at = excluded.updated_at
      `,
      args: [
        body.trade_name || "",
        body.legal_name || "",
        body.owner_name || "",
        body.nif || "",
        body.address_line1 || "",
        body.address_line2 || "",
        body.phone || "",
        body.email || "",
        body.iban || "",
        body.bank_name || "",
        body.invoice_series_prefix || "FAC-",
        body.budget_series_prefix || "PRES-",
        body.work_order_series_prefix || "PT-",
        body.default_tax_rate ?? 21,
        body.theme_color || "#2563eb",
        now,
      ],
    });

    return NextResponse.json({ success: true, message: "Configuración guardada correctamente" });
  } catch (error) {
    console.error("Error saving company settings:", error);
    return NextResponse.json({ error: "Error al guardar configuración" }, { status: 500 });
  }
}
