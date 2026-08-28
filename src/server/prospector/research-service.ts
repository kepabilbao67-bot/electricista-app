import type {
  RawCompanyResult,
  ResearchedCompany,
  WebsiteEvidence,
  VerifiedField,
} from './types';

export interface ResearchOptions {
  verifyWebsitesLive?: boolean;
  websiteProbeTimeoutMs?: number;
}

export class ResearchService {
  private readonly verifyWebsitesLive: boolean;
  private readonly websiteProbeTimeoutMs: number;

  constructor(options: ResearchOptions = {}) {
    this.verifyWebsitesLive = options.verifyWebsitesLive ?? false;
    this.websiteProbeTimeoutMs = options.websiteProbeTimeoutMs ?? 3000;
  }

  async researchCompany(
    raw: RawCompanyResult,
    targetProduct = 'Autónomo360'
  ): Promise<ResearchedCompany> {
    const researchNotes: string[] = [];

    // 1. Traceability & Source
    const sourceUrl = raw.sourceUrl || `https://www.openstreetmap.org/${raw.type}/${raw.id}`;
    researchNotes.push(`Empresa obtenida desde fuente pública: ${sourceUrl}`);

    // 2. Address Verification
    const address: VerifiedField<string> = raw.address
      ? {
          value: [raw.address, raw.postalCode, raw.city, raw.province]
            .filter(Boolean)
            .join(', '),
          confidence: 'VERIFICADO',
          evidence: `Dirección física declarada en fuente pública: ${raw.address}`,
          sourceUrl,
        }
      : {
          value: [raw.city, raw.province].filter(Boolean).join(', ') || undefined,
          confidence: raw.city ? 'INFERIDO' : 'NO_DISPONIBLE',
          evidence: raw.city ? 'Ubicación municipal inferida de la zona de búsqueda' : undefined,
          sourceUrl,
        };

    // 3. Phone Verification (Strict: only if literally present in source)
    const phone: VerifiedField<string> = raw.phone
      ? {
          value: raw.phone,
          confidence: 'VERIFICADO',
          evidence: `Teléfono publicado en registro público: ${raw.phone}`,
          sourceUrl,
        }
      : {
          value: undefined,
          confidence: 'NO_DISPONIBLE',
          evidence: 'No figura teléfono en la fuente pública consultada',
        };

    // 4. Email Verification (Strict: only if literally present in source, never generated)
    const email: VerifiedField<string> = raw.email
      ? {
          value: raw.email,
          confidence: 'VERIFICADO',
          evidence: `Email público publicado en registro: ${raw.email}`,
          sourceUrl,
        }
      : {
          value: undefined,
          confidence: 'NO_DISPONIBLE',
          evidence: 'No figura correo electrónico en la fuente pública consultada (no se generan emails ficticios)',
        };

    // 5. Website Verification (Strict: distinguish published URL from verified active website)
    const website = await this.evaluateWebsite(raw.website, sourceUrl);

    // 6. Contact Form (Strict: NO automatic /contacto inference)
    const contactFormUrl: VerifiedField<string> = raw.contactFormUrl
      ? {
          value: raw.contactFormUrl,
          confidence: 'VERIFICADO',
          evidence: `Formulario de contacto publicado en la fuente: ${raw.contactFormUrl}`,
          sourceUrl,
        }
      : {
          value: undefined,
          confidence: 'NO_DISPONIBLE',
          evidence: 'No existe evidencia directa de formulario de contacto',
        };

    // 7. Contact Person (Strict: no generic titles, only if real name found in source)
    const contactPerson: VerifiedField<string> = raw.contactPerson && raw.contactPerson.trim().length > 0
      ? {
          value: raw.contactPerson.trim(),
          confidence: 'VERIFICADO',
          evidence: `Persona identificada en fuente pública: ${raw.contactPerson}`,
          sourceUrl,
        }
      : {
          value: undefined,
          confidence: 'NO_DISPONIBLE',
          evidence: 'No figura persona de contacto con nombre propio en la fuente pública consultada',
        };

    // 8. Sector
    const craft = raw.tags?.craft || raw.tags?.shop || 'electrician';
    const sectorDisplay =
      craft === 'electrician' || craft === 'electrical'
        ? 'Instalaciones Eléctricas'
        : craft;

    const sector: VerifiedField<string> = {
      value: sectorDisplay,
      confidence: 'VERIFICADO',
      evidence: `Actividad registrada en etiqueta OSM: ${craft}`,
      sourceUrl,
    };

    // 9. Inferred Business Characteristics (Strictly marked as INFERIDO)
    const inferredSize = {
      value: 'Autónomo o microempresa (1-5 personas)',
      confidence: 'INFERIDO' as const,
      evidence: 'Hipótesis sectorial habitual en instaladores locales sin múltiples sedes registradas',
    };

    const inferredNeeds = {
      workReports: {
        value: true,
        confidence: 'INFERIDO' as const,
        evidence: 'Los instaladores eléctricos requieren habitualmente emisión de partes de trabajo y certificaciones en obra',
      },
      budgets: {
        value: true,
        confidence: 'INFERIDO' as const,
        evidence: 'La actividad de reformas e instalaciones suele requerir elaboración previa de presupuestos desglosados',
      },
      invoicing: {
        value: true,
        confidence: 'INFERIDO' as const,
        evidence: 'Normativa fiscal (e.g. TicketBAI / Factura Electrónica) aplicable a autónomos y empresas del sector',
      },
      adminBurden: {
        value: 'Carga de gestión documental técnica y administrativa en desplazamientos',
        confidence: 'INFERIDO' as const,
        evidence: 'Deducción operativa estándar de profesionales con trabajo en campo',
      },
    };

    return {
      id: `${raw.type}_${raw.id}`,
      osmType: raw.type,
      osmId: raw.id,
      name: raw.name,
      sourceUrl,
      address,
      phone,
      email,
      website,
      contactFormUrl,
      contactPerson,
      sector,
      inferredSize,
      inferredNeeds,
      researchNotes,
    };
  }

  private async evaluateWebsite(
    rawWebsiteUrl?: string,
    sourceUrl?: string
  ): Promise<WebsiteEvidence> {
    if (!rawWebsiteUrl || rawWebsiteUrl.trim().length === 0) {
      return {
        url: undefined,
        status: 'NO_DISPONIBLE',
        confidence: 'NO_DISPONIBLE',
        verifiedLive: false,
        notes: 'No figura sitio web en la fuente consultada',
      };
    }

    const cleanUrl = rawWebsiteUrl.trim().startsWith('http')
      ? rawWebsiteUrl.trim()
      : `https://${rawWebsiteUrl.trim()}`;

    // If live verification is requested, probe safely
    if (this.verifyWebsitesLive) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.websiteProbeTimeoutMs
        );

        const res = await fetch(cleanUrl, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'KepaForce360-Prospector/1.0 (Web Probe)' },
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          return {
            url: cleanUrl,
            status: 'WEBSITE_VERIFICADA',
            confidence: 'VERIFICADO',
            verifiedLive: true,
            notes: `Comprobación HTTP HEAD exitosa (HTTP ${res.status})`,
          };
        }
      } catch {
        // Fallback if probe failed
      }
    }

    // Default: URL published in source, but NOT verified live
    return {
      url: cleanUrl,
      status: 'URL_PUBLICADA_EN_FUENTE',
      confidence: 'INFERIDO', // URL is in source, but active corporate website is not verified live
      verifiedLive: false,
      notes: `URL publicada en el registro público (${sourceUrl}), pendiente de verificación técnica de disponibilidad`,
    };
  }
}
