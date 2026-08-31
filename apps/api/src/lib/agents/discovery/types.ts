export type DiscoveryMarket = {
  locationCode: number;
  languageCode: string;
  label: string;
};

/** Defaults LATAM / AR. */
export const DISCOVERY_MARKETS: Record<string, DiscoveryMarket> = {
  ar: { locationCode: 2032, languageCode: 'es', label: 'Argentina' },
  mx: { locationCode: 2484, languageCode: 'es', label: 'México' },
  es: { locationCode: 2724, languageCode: 'es', label: 'España' },
  latam: { locationCode: 2032, languageCode: 'es', label: 'Latinoamérica (AR)' },
};

export type DiscoveryExploreInput = {
  siteUrl: string;
  description: string;
  /** Código mercado: ar | mx | es | latam, o locationCode numérico vía marketCode */
  market?: string;
  languageCode?: string;
  seeds: string[];
  /** Incluir keywords_for_site (cuesta 1 request extra) */
  includeSiteKeywords?: boolean;
  /** Máx. candidatos a enriquecer con LLM / persistir */
  maxCandidates?: number;
};

export type DiscoveryKeywordCandidate = {
  keyword: string;
  seedKeyword: string;
  monthlySearches: number | null;
  competitionIndex: number | null;
  demandScore: number;
  trendScore: number;
  trendLabel: 'growing' | 'stable' | 'declining';
  source: 'keywords_for_keywords' | 'keywords_for_site';
};

export type OpportunityBrief = {
  topic: string;
  primaryQuery: string;
  relatedQueries: string[];
  intent: 'informational' | 'comparison' | 'commercial' | 'transactional' | 'navigational';
  intentLabel: string;
  stage: 'tofu' | 'mofu' | 'bofu';
  cluster: string;
  trend: 'growing' | 'stable' | 'declining';
  opportunityScore: number;
  businessRelevance: 'very_high' | 'high' | 'medium' | 'low';
  relevanceScore: number;
  demandScore: number;
  trendScore: number;
  monthlySearches: number | null;
  recommendedContent: string;
  suggestedAngle: string;
  target: string;
  provider: 'dataforseo';
  providerMode: 'sandbox' | 'live';
};

export type DiscoverySettings = {
  siteUrl?: string;
  description?: string;
  market?: string;
  languageCode?: string;
  seeds?: string[];
};
