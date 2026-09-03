import type { DiscoveryKeywordCandidate, OpportunityBrief } from './types';
import {
  computeOpportunityScore,
  intentToStage,
  relevanceLabel,
} from './score';

type LlmEnrichItem = {
  keyword: string;
  intent: OpportunityBrief['intent'];
  intentLabel: string;
  cluster: string;
  relevanceScore: number;
  recommendedContent: string;
  suggestedAngle: string;
  target: string;
  relatedQueries: string[];
};

function fallbackEnrich(
  candidate: DiscoveryKeywordCandidate,
  description: string,
): LlmEnrichItem {
  const kw = candidate.keyword.toLowerCase();
  let intent: OpportunityBrief['intent'] = 'informational';
  if (/\bvs\b|versus|compar/.test(kw)) intent = 'comparison';
  else if (/precio|costo|comprar|contratar/.test(kw)) intent = 'transactional';
  else if (/mejor|para empresas|herramienta/.test(kw)) intent = 'commercial';

  return {
    keyword: candidate.keyword,
    intent,
    intentLabel: intent,
    cluster: `Cluster: ${candidate.seedKeyword}`,
    relevanceScore: 55,
    recommendedContent: intent === 'comparison' ? 'Comparativa' : 'Guía práctica',
    suggestedAngle: `Cómo abordar “${candidate.keyword}” para ${description.slice(0, 80)}`,
    target: 'Empresas que buscan esta solución en el mercado objetivo',
    relatedQueries: [],
  };
}

async function callOpenAiJson(prompt: string): Promise<unknown | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Sos el agente Discovery. Clasificás búsquedas para un negocio. Respondé solo JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    console.warn('[discovery] OpenAI error', res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Clasifica intent + relevancia de negocio + ángulo editorial (batch).
 */
export async function enrichCandidatesWithLlm(
  candidates: DiscoveryKeywordCandidate[],
  ctx: {
    siteUrl: string;
    description: string;
    marketLabel: string;
    providerMode: 'sandbox' | 'live';
  },
): Promise<OpportunityBrief[]> {
  const byKey = new Map(candidates.map((c) => [c.keyword.toLowerCase(), c]));
  const list = candidates.map((c) => ({
    keyword: c.keyword,
    monthly_searches: c.monthlySearches,
    demand: c.demandScore,
    trend: c.trendScore,
    trend_label: c.trendLabel,
  }));

  const prompt = `Negocio:
SITE: ${ctx.siteUrl}
DESCRIPCIÓN: ${ctx.description}
MERCADO: ${ctx.marketLabel}

Clasificá cada keyword. Devolvé JSON:
{
  "items": [
    {
      "keyword": "string exacta de la lista",
      "intent": "informational|comparison|commercial|transactional|navigational",
      "intentLabel": "string corta en español",
      "cluster": "nombre de cluster temático",
      "relevanceScore": 0-100,
      "recommendedContent": "Guía práctica|FAQ|Comparativa|Checklist|How-to|Pilar",
      "suggestedAngle": "ángulo editorial en 1 frase",
      "target": "a quién le habla",
      "relatedQueries": ["hasta 5 related de la misma lista o variantes cortas"]
    }
  ]
}

Reglas:
- relevanceScore alto SOLO si la keyword sirve DIRECTAMENTE al negocio descrito.
- Si es genérica (seo tools, seotools, marketing tools) y el negocio no es SEO → relevanceScore <= 20.
- Preferí español / Latam cuando el mercado lo indique.
- Agrupá keywords cercanas en el mismo cluster.
- No inventes volúmenes.
- suggestedAngle en español, concreto al negocio (no “Cómo abordar X para…” genérico).

Keywords:
${JSON.stringify(list, null, 2)}`;

  const parsed = await callOpenAiJson(prompt);
  const itemsRaw =
    parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)
      ? ((parsed as { items: LlmEnrichItem[] }).items ?? [])
      : [];

  const enrichMap = new Map<string, LlmEnrichItem>();
  for (const item of itemsRaw) {
    if (!item?.keyword) continue;
    enrichMap.set(String(item.keyword).toLowerCase(), {
      ...item,
      relevanceScore: Math.max(0, Math.min(100, Number(item.relevanceScore) || 50)),
      relatedQueries: Array.isArray(item.relatedQueries)
        ? item.relatedQueries.map(String).slice(0, 5)
        : [],
    });
  }

  const briefs: OpportunityBrief[] = [];

  for (const candidate of candidates) {
    const enrich =
      enrichMap.get(candidate.keyword.toLowerCase()) ??
      fallbackEnrich(candidate, ctx.description);

    const relevanceScore = enrich.relevanceScore;
    const opportunityScore = computeOpportunityScore(
      candidate.demandScore,
      candidate.trendScore,
      relevanceScore,
    );

    // related: prefer LLM, else siblings same seed with volume
    const related =
      enrich.relatedQueries.length > 0
        ? enrich.relatedQueries
        : candidates
            .filter(
              (c) =>
                c.keyword !== candidate.keyword &&
                c.seedKeyword === candidate.seedKeyword,
            )
            .slice(0, 5)
            .map((c) => c.keyword);

    briefs.push({
      topic: candidate.keyword,
      primaryQuery: candidate.keyword,
      relatedQueries: related,
      intent: enrich.intent ?? 'informational',
      intentLabel: enrich.intentLabel || enrich.intent || 'Informational',
      stage: intentToStage(enrich.intent ?? 'informational'),
      cluster: enrich.cluster || `Cluster: ${candidate.seedKeyword}`,
      trend: candidate.trendLabel,
      opportunityScore,
      businessRelevance: relevanceLabel(relevanceScore),
      relevanceScore,
      demandScore: candidate.demandScore,
      trendScore: candidate.trendScore,
      monthlySearches: candidate.monthlySearches,
      recommendedContent: enrich.recommendedContent || 'Guía práctica',
      suggestedAngle: enrich.suggestedAngle,
      target: enrich.target,
      provider: 'dataforseo',
      providerMode: ctx.providerMode,
      channels: ['google'],
      sources: {
        google: {
          monthlySearches: candidate.monthlySearches,
          demandScore: candidate.demandScore,
          trendScore: candidate.trendScore,
          trendLabel: candidate.trendLabel,
          dfsSources: [candidate.source],
        },
      },
    });

    void byKey;
  }

  briefs.sort((a, b) => b.opportunityScore - a.opportunityScore);
  return briefs;
}
