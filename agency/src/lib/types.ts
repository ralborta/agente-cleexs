/* Tipos compartidos entre las rutas /api/cleexs/* y la UI */

export type Top3Entry = { name: string; type: 'brand' | 'competitor' | 'other'; position: number };

export type PromptRow = {
  id: string; // promptResult id
  promptId: string;
  name: string; // p.ej. "Consideración (30%) - Comparativo"
  text: string;
  intent: string | null; // "Consideración (30%)"
  type: string | null; // "Comparativo"
  top3: Top3Entry[];
  brandInTop3: boolean;
  brandPosition: number | null;
  score: number;
  model: string | null;
  responseExcerpt?: string;
};

export type RunSummary = {
  id: string;
  createdAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  runType: string;
  status: string;
  country: string | null;
  model: string | null;
  promptsAnalyzed: number;
  brandInTop3: number;
  visibilityPct: number | null;
  /** apariciones en top3 por entidad (clave normalizada) */
  appearances: Record<string, number>;
  prompts: PromptRow[];
};

export type CompetitorKind = 'objetivo' | 'directo' | 'emergente';

export type CompetitorMention = {
  key: string;
  name: string;
  domain: string | null;
  kind: CompetitorKind;
  appearances: number;
  avgPosition: number | null;
};

export type BrandInfo = {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
  industry: string | null;
  aliases: string[];
  competitors: { id: string; name: string; displayName: string; domain: string | null; validated: boolean }[];
};

export type AgencySnapshot = {
  source: 'cleexs';
  generatedAt: string;
  apiUrl: string;
  brand: BrandInfo;
  /** Visibilidad: % de prompts con la marca en top 3 (brandInTop3Pct); fallback a score medio */
  visibilityPct: number | null;
  visibilitySource: 'brandInTop3Pct' | 'score' | 'none';
  latestRun: RunSummary | null;
  competitorMentions: CompetitorMention[];
  weakPrompts: { prompt: string; type: string | null; score: number; top: string[] }[];
  history: RunSummary[]; // cronológico ascendente, 1 punto por corrida
  prompts: PromptRow[]; // prompts de la última corrida
  llms: { model: string; label: string; responses: number; mentions: number; visibilityPct: number | null }[];
  /** Solo si hay CLEEXS_MARKETING_SERVICE_KEY: valor crudo informativo, no se rotula en UI */
  priaTotal: number | null;
  // No disponible aún en backend → siempre vacío
  sources: never[];
  sentiment: never[];
  buyerPersonas: never[];
  warnings: string[];
};
