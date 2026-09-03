export type DiscoveryMarket = {
  locationCode: number;
  languageCode: string;
  /** Nombre en inglés para YouTube SERP / Trends (location lists DFS). */
  locationName: string;
  label: string;
};

/** Defaults LATAM / AR. */
export const DISCOVERY_MARKETS: Record<string, DiscoveryMarket> = {
  ar: {
    locationCode: 2032,
    languageCode: 'es',
    locationName: 'Argentina',
    label: 'Argentina',
  },
  mx: {
    locationCode: 2484,
    languageCode: 'es',
    locationName: 'Mexico',
    label: 'México',
  },
  co: {
    locationCode: 2170,
    languageCode: 'es',
    locationName: 'Colombia',
    label: 'Colombia',
  },
  es: {
    locationCode: 2724,
    languageCode: 'es',
    locationName: 'Spain',
    label: 'España',
  },
  /** Ads no tiene “Latam”: usamos AR como proxy de volumen en español. */
  latam: {
    locationCode: 2032,
    languageCode: 'es',
    locationName: 'Argentina',
    label: 'Latam (proxy Argentina)',
  },
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
  /**
   * Expansión Labs: related_keywords + keyword_suggestions por semilla.
   * Default true — sin esto solo hay ideas de Google Ads (pocas).
   */
  deepExpand?: boolean;
  /** Enriquecer top keywords con YouTube SERP + Trends (default true). */
  includeYoutube?: boolean;
  /** Máx. keywords a enriquecer con YouTube (default 10, máx 20). */
  youtubeMaxKeywords?: number;
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
  source:
    | 'keywords_for_keywords'
    | 'keywords_for_site'
    | 'related_keywords'
    | 'keyword_suggestions';
};

export type DiscoveryChannel = 'google' | 'youtube';

export type YoutubeRelatedQuery = {
  query: string;
  value: string;
  kind: 'top' | 'rising';
};

export type YoutubeRelatedTopic = {
  title: string;
  value: string;
  kind: 'top' | 'rising';
};

export type YoutubeTopVideo = {
  title: string;
  videoId: string;
  url: string | null;
  channelName: string | null;
  views: number | null;
  rank: number | null;
  isShorts: boolean;
};

export type YoutubeTopChannel = {
  name: string;
  channelId: string | null;
  url: string | null;
  videoCount: number;
  totalViews: number;
};

export type YoutubeSourceData = {
  interest: number | null;
  trend: 'growing' | 'stable' | 'declining' | 'unknown';
  relatedQueries: YoutubeRelatedQuery[];
  relatedTopics: YoutubeRelatedTopic[];
  topVideos: YoutubeTopVideo[];
  topChannels: YoutubeTopChannel[];
  contentPatterns: string[];
  cost: number;
  fetchedAt: string;
};

export type GoogleSourceData = {
  monthlySearches: number | null;
  demandScore: number;
  trendScore: number;
  trendLabel: 'growing' | 'stable' | 'declining';
  dfsSources: string[];
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
  /** Presencia de mercado: google, youtube o ambos. */
  channels?: DiscoveryChannel[];
  sources?: {
    google: GoogleSourceData;
    youtube?: YoutubeSourceData;
  };
};

export type DiscoverySettings = {
  siteUrl?: string;
  description?: string;
  market?: string;
  languageCode?: string;
  seeds?: string[];
  includeYoutube?: boolean;
};
