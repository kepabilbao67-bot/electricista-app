export type EvidenceType = 'VERIFICADO' | 'INFERIDO' | 'NO_DISPONIBLE';

export type WebsiteStatus =
  | 'URL_PUBLICADA_EN_FUENTE'
  | 'WEBSITE_VERIFICADA'
  | 'NO_DISPONIBLE';

export type PriorityLevel = 'BAJA' | 'MEDIA' | 'ALTA' | 'MUY ALTA';

export interface VerifiedField<T> {
  value: T | undefined;
  confidence: EvidenceType;
  evidence?: string;
  sourceUrl?: string;
}

export interface RawCompanyResult {
  id: string | number;
  type: 'node' | 'way' | 'relation';
  name: string;
  lat?: number;
  lon?: number;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactPerson?: string;
  contactFormUrl?: string;
  tags?: Record<string, string>;
  sourceUrl: string;
}

export interface CompanySearchQuery {
  sector: string;
  location: string;
  targetSize?: string;
  product?: string;
  limit?: number;
}

export interface WebsiteEvidence {
  url?: string;
  status: WebsiteStatus;
  confidence: EvidenceType;
  verifiedLive: boolean;
  notes?: string;
}

export interface InferredNeedItem {
  value: boolean;
  confidence: 'INFERIDO' | 'VERIFICADO';
  evidence: string;
}

export interface ResearchedCompany {
  id: string;
  osmType: 'node' | 'way' | 'relation';
  osmId: string | number;
  name: string;
  sourceUrl: string;
  address: VerifiedField<string>;
  phone: VerifiedField<string>;
  email: VerifiedField<string>;
  website: WebsiteEvidence;
  contactFormUrl: VerifiedField<string>;
  contactPerson: VerifiedField<string>;
  sector: VerifiedField<string>;
  inferredSize: {
    value: string;
    confidence: 'INFERIDO' | 'VERIFICADO';
    evidence: string;
  };
  inferredNeeds: {
    workReports: InferredNeedItem;
    budgets: InferredNeedItem;
    invoicing: InferredNeedItem;
    adminBurden: {
      value: string;
      confidence: 'INFERIDO';
      evidence: string;
    };
  };
  researchNotes: string[];
}

export interface ScoreFactor {
  factorId: string;
  name: string;
  value: string | number | boolean;
  points: number;
  maxPoints: number;
  evidenceType: EvidenceType;
  evidence: string;
}

export interface ScoredLead {
  company: ResearchedCompany;
  totalScore: number;
  priority: PriorityLevel;
  breakdown: ScoreFactor[];
  recommendedProduct: string;
  scoredAt: string;
}

export interface CommercialMessages {
  linkedIn: {
    title: string;
    text: string;
    notice: string;
  };
  email: {
    subject: string;
    text: string;
  };
  whatsapp: {
    text: string;
  };
  sms: {
    text: string;
  };
  generatedAt: string;
}

export interface ProspectorLead extends ScoredLead {
  messages: CommercialMessages;
}
