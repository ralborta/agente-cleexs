import type { StrategistPlan } from './types';

const TAVILY_API_URL = 'https://api.tavily.com/search';

function readTavilyKey(): string | null {
  return process.env.TAVILY_API_KEY?.trim() || null;
}

export function isWebResearchEnabled(): boolean {
  return Boolean(readTavilyKey());
}

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
};

async function tavilySearch(query: string, maxResults = 6): Promise<TavilyResult[]> {
  const apiKey = readTavilyKey();
  if (!apiKey) return [];

  try {
    const res = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.warn(`[teo-research] Tavily respondió ${res.status}`);
      return [];
    }

    const data = (await res.json()) as { results?: TavilyResult[] };
    return data.results ?? [];
  } catch (err) {
    console.warn('[teo-research] Tavily search falló:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Investigación real en la web (vía Tavily) para dar al LLM fuentes verificadas
 * en lugar de que invente/recuerde datos de memoria. Se degrada de forma segura:
 * si TAVILY_API_KEY no está configurada o la búsqueda falla, devuelve null y
 * el pipeline sigue con el outline/fuentes estáticas de siempre.
 */
export async function runWebResearch(
  plan: StrategistPlan,
): Promise<{ sources: string[] } | null> {
  if (!isWebResearchEnabled()) return null;

  const isPro = plan.depth === 'pro' || plan.pieceType === 'pillar';
  const query = `${plan.topic} ${isPro ? 'guía completa datos estadísticas' : 'PyMEs'} 2026`.trim();

  const results = await tavilySearch(query, 6);
  const usable = results.filter((r) => r.url && r.title);
  if (!usable.length) return null;

  const sources = usable.slice(0, 6).map((r) => {
    const summary = r.content ? ` — Resumen: ${r.content.slice(0, 260).trim()}` : '';
    return `${r.title} — ${r.url}${summary}`;
  });

  return { sources };
}
