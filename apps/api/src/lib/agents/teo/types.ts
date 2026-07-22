export type StrategistPlan = {
  topic: string;
  pieceType: string;
  title: string;
  keyword: string;
  objective: string;
  /** standard = plantilla rápida; pro = profundo (LLM o fallback enriquecido) */
  depth?: 'standard' | 'pro';
};

export type ResearchResult = {
  outline: string[];
  sources: string[];
};
