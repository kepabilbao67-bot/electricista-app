import type {
  CompanySearchQuery,
  ProspectorLead,
  RawCompanyResult,
} from './types';
import { OverpassSearchProvider, type SearchProvider } from './search-provider';
import { ResearchService } from './research-service';
import { ScoringService } from './scoring-service';
import { MessagingService } from './messaging-service';

export interface ProspectorEngineOptions {
  searchProvider?: SearchProvider;
  researchService?: ResearchService;
  scoringService?: ScoringService;
  messagingService?: MessagingService;
}

export class ProspectorEngine {
  private readonly searchProvider: SearchProvider;
  private readonly researchService: ResearchService;
  private readonly scoringService: ScoringService;
  private readonly messagingService: MessagingService;

  constructor(options: ProspectorEngineOptions = {}) {
    this.searchProvider = options.searchProvider || new OverpassSearchProvider();
    this.researchService = options.researchService || new ResearchService();
    this.scoringService = options.scoringService || new ScoringService();
    this.messagingService = options.messagingService || new MessagingService();
  }

  async prospect(query: CompanySearchQuery): Promise<ProspectorLead[]> {
    // 1. Search raw companies from the provider (Overpass in production, or injected mock in tests)
    const rawResults: RawCompanyResult[] = await this.searchProvider.search(query);

    // If source returned 0, strictly return 0. Never artificially pad results.
    if (!rawResults || rawResults.length === 0) {
      return [];
    }

    const leads: ProspectorLead[] = [];

    // 2. Process each company sequentially
    for (const raw of rawResults) {
      const researched = await this.researchService.researchCompany(
        raw,
        query.product || 'Autónomo360'
      );
      const scored = this.scoringService.scoreCompany(
        researched,
        query.product || 'Autónomo360'
      );
      const messages = this.messagingService.generateDrafts(scored);

      leads.push({
        ...scored,
        messages,
      });
    }

    // Sort by total score descending
    leads.sort((a, b) => b.totalScore - a.totalScore);

    return leads;
  }
}
