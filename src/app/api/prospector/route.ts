// PROSPECTOR API: Requiere consentimiento explícito del usuario final. No almacena PII sin autorización.

import { NextRequest, NextResponse } from "next/server";
import { ProspectorEngine } from "@/server/prospector/engine";
import type { CompanySearchQuery } from "@/server/prospector/types";

function checkAuthorization(request: NextRequest): boolean {
  const expectedUser = process.env.APP_BASIC_AUTH_USER;
  const expectedPassword = process.env.APP_BASIC_AUTH_PASSWORD;
  const apiKey = process.env.PROSPECTOR_API_KEY;

  const authHeader = request.headers.get("authorization");

  if (apiKey && authHeader === `Bearer ${apiKey}`) {
    return true;
  }

  if (expectedUser && expectedPassword) {
    if (authHeader?.startsWith("Basic ")) {
      try {
        const encoded = authHeader.slice("Basic ".length);
        const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
        const decoded = new TextDecoder("utf-8").decode(bytes);
        const separatorIndex = decoded.indexOf(":");
        const providedUser = decoded.slice(0, separatorIndex);
        const providedPassword = decoded.slice(separatorIndex + 1);
        return (
          providedUser === expectedUser && providedPassword === expectedPassword
        );
      } catch {
        return false;
      }
    }
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  if (!checkAuthorization(request)) {
    return NextResponse.json(
      { error: "No autorizado. Se requieren credenciales válidas." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const { sector, location, targetSize, product, limit } = body || {};

    if (!sector || typeof sector !== "string" || !sector.trim()) {
      return NextResponse.json(
        { error: "El parámetro 'sector' es obligatorio y debe ser una cadena no vacía." },
        { status: 400 }
      );
    }

    if (!location || typeof location !== "string" || !location.trim()) {
      return NextResponse.json(
        { error: "El parámetro 'location' es obligatorio y debe ser una cadena no vacía." },
        { status: 400 }
      );
    }

    let parsedLimit: number | undefined;
    if (limit !== undefined) {
      const num = Number(limit);
      if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
        return NextResponse.json(
          { error: "El parámetro 'limit' debe ser un número entero positivo si se especifica." },
          { status: 400 }
        );
      }
      parsedLimit = Math.min(num, 50);
    }

    const query: CompanySearchQuery = {
      sector: sector.trim(),
      location: location.trim(),
      targetSize: typeof targetSize === "string" ? targetSize.trim() : undefined,
      product: typeof product === "string" ? product.trim() : undefined,
      limit: parsedLimit,
    };

    const engine = new ProspectorEngine();
    const leads = await engine.prospect(query);

    return NextResponse.json({
      success: true,
      query: {
        sector: query.sector,
        location: query.location,
      },
      count: leads.length,
      leads,
    });
  } catch {
    return NextResponse.json(
      { error: "Error interno al procesar la prospección" },
      { status: 500 }
    );
  }
}
