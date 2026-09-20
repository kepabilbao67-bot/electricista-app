import { parseVoiceOrder, VoiceOrderDraft, VoiceOrderItem } from "./voice-order-parser";
import { electricistaDomainAdapter } from "./assistant/electricista-adapter";
import type { Voice360CatalogCandidate } from "./assistant/types";

export interface EnrichedVoiceOrderItem extends VoiceOrderItem {
  catalog_item?: Voice360CatalogCandidate;
  estimated_cost?: number;
}

export interface InterpretedVoiceOrderResult {
  success: boolean;
  status: "DRAFT" | "PENDING_APPROVAL" | "CONFIRMED" | "ERROR";
  intent: string;
  originalText: string;
  neededDate: string | null;
  neededDateLabel: string;
  items: EnrichedVoiceOrderItem[];
  safeDraft: {
    supplier: string;
    neededDate: string | null;
    itemsCount: number;
    estimatedCostTotal: number;
    hasUnresolvedItems: boolean;
  };
  pendingAction?: {
    action: string;
    label: string;
    requires_human_approval: boolean;
    auto_send_supplier: boolean;
  };
  requestId: string;
  error?: string;
}

export interface InterpretVoiceOrderOptions {
  tenantId?: string;
  requestId?: string;
  /** Conservado por compatibilidad con POST /api/pedidos-voz/interpretar. */
  channel?: string;
  referenceDate?: Date;
}

/**
 * Pipeline integral de pedidos-voz, 100% local (sin motor externo):
 * 1. Normalización de jerga de electricista (adapter.normalizeInput)
 * 2. Parsing de cantidades y fechas (voice-order-parser)
 * 3. Resolución de materiales de catálogo SOKOEL (adapter.resolveCatalogItem)
 * 4. Aplicación estricta de Human Gate (PENDING_APPROVAL, NO autoenvío)
 *
 * El servidor Voice360 externo (localhost:3088) está retirado: este pipeline
 * no realiza ninguna llamada HTTP.
 */
export async function interpretVoiceOrder(
  rawText: string,
  options: InterpretVoiceOrderOptions = {}
): Promise<InterpretedVoiceOrderResult> {
  const tenantId = options.tenantId || "tenant-default-electricista";
  const requestId = options.requestId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`);

  // 1. Normalización de jerga técnica
  let normalizedText = rawText;
  if (electricistaDomainAdapter.normalizeInput) {
    normalizedText = await Promise.resolve(electricistaDomainAdapter.normalizeInput(rawText));
  }

  // 2. Parser vertical eléctrico
  let parsedDraft: VoiceOrderDraft;
  try {
    parsedDraft = parseVoiceOrder(normalizedText, options.referenceDate);
  } catch (err: any) {
    return {
      success: false,
      status: "ERROR",
      intent: "electricista:order_error",
      originalText: rawText,
      neededDate: null,
      neededDateLabel: "",
      items: [],
      safeDraft: {
        supplier: "SOKOEL",
        neededDate: null,
        itemsCount: 0,
        estimatedCostTotal: 0,
        hasUnresolvedItems: true,
      },
      requestId,
      error: err?.message || "No se pudieron identificar productos cuantificados",
    };
  }

  // 3. Resolución de catálogo SOKOEL vertical
  const enrichedItems: EnrichedVoiceOrderItem[] = [];
  let estimatedCostTotal = 0;
  let hasUnresolvedItems = false;

  for (const item of parsedDraft.items) {
    let resolvedCatalog: Voice360CatalogCandidate | undefined;
    if (electricistaDomainAdapter.resolveCatalogItem) {
      const candidates = await Promise.resolve(electricistaDomainAdapter.resolveCatalogItem(item.product, tenantId));
      if (candidates && candidates.length > 0) {
        resolvedCatalog = candidates[0];
      }
    }

    if (resolvedCatalog) {
      const itemCost = resolvedCatalog.unit_price * item.quantity;
      estimatedCostTotal += itemCost;
      enrichedItems.push({
        ...item,
        catalog_item: resolvedCatalog,
        estimated_cost: itemCost,
      });
    } else {
      hasUnresolvedItems = true;
      enrichedItems.push({
        ...item,
      });
    }
  }

  // 4. Construcción del resultado seguro con Human Gate
  return {
    success: true,
    status: "PENDING_APPROVAL",
    intent: "electricista:order_draft",
    originalText: rawText,
    neededDate: parsedDraft.neededDate,
    neededDateLabel: parsedDraft.neededDateLabel,
    items: enrichedItems,
    safeDraft: {
      supplier: "SOKOEL",
      neededDate: parsedDraft.neededDate,
      itemsCount: enrichedItems.length,
      estimatedCostTotal: Math.round(estimatedCostTotal * 100) / 100,
      hasUnresolvedItems,
    },
    pendingAction: {
      action: "create_purchase_order",
      label: `Confirmar pedido de ${enrichedItems.length} material(es) a SOKOEL`,
      requires_human_approval: true,
      auto_send_supplier: false,
    },
    requestId,
  };
}
