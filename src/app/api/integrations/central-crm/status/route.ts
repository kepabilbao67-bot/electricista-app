import { NextResponse } from "next/server";
import { centralCrmConfiguration } from "@/lib/central-crm/config";

export const dynamic = "force-dynamic";

export function GET() {
  const config = centralCrmConfiguration();
  return NextResponse.json({
    integration: "llamadas360-central-crm",
    configured: config.ready,
    reason: config.ready ? null : config.reason,
    // A real connection is NOT verified by configuration alone.
    connected: false,
    contractVerified: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
