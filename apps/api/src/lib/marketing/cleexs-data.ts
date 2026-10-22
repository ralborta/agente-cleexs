import { prisma } from '../prisma';

/**
 * Datos REALES de Cleexs (marca, competidores, Cleexs Score, consultas por intención).
 *
 * Vía principal: GET /api/marketing/snapshot de la API de Cleexs (server-to-server con clave).
 * Vía de respaldo (mismos datos, endpoints actuales de Cleexs): GET /api/brands/:id,
 * GET /api/runs?brandId= y GET /api/runs/:id — se arma el mismo snapshot localmente.
 *
 * Si falta configuración o Cleexs no responde, devuelve configured:false.
 * Nunca se inventan datos: todo sale de la base y el motor de Cleexs.
 */
export type CleexsSnapshot = {
  source: 'cleexs';
  generatedAt: string;
  brand: {
    id: string;
    tenantId: string;
    name: string;
    domain: string | null;
    industry: string | null;
    productType: string | null;
    country: string | null;
    category: string | null;
    objective: string | null;
    description: string | null;
    aliases: string[];
    competitors: Array<{ id: string; name: string; domain: string | null; category: string | null; validated: boolean }>;
  };
  cleexsScore: number | null;
  latest: {
    runId: string;
    createdAt: string;
    cleexsScore: number | null;
    promptsAnalyzed: number;
    brandInTop3: number;
    brandInTop3Pct: number;
    brandPosition1: number;
    competitorMentions: Array<{ name: string; appearances: number; averagePosition: number }>;
    scoreByIntention: Array<{ intention: string; score: number }>;
    weakPrompts: Array<{ prompt: string; intention: string | null; score: number; top: string[] }>;
  } | null;
  history: Array<{ runId: string; status: string; runType: string; createdAt: string; cleexsScore: number | null; resultsCount: number }>;
};

export type CleexsDataResult =
  | { configured: true; snapshot: CleexsSnapshot }
  | { configured: false; reason: string };

async function workspaceDomain(workspaceId: string): Promise<string | null> {
  const fromEnv = (process.env.CLEEXS_MARKETING_DOMAIN || '').trim();
  if (fromEnv) return fromEnv;
  const discovery = await prisma.agent.findUnique({ where: { slug: 'discovery' }, select: { id: true } });
  if (!discovery) return null;
  const config = await prisma.agentConfig.findUnique({
    where: { workspaceId_agentId: { workspaceId, agentId: discovery.id } },
    select: { settings: true },
  });
  const settings = (config?.settings ?? null) as { siteUrl?: string } | null;
  return settings?.siteUrl?.trim() || null;
}

function baseUrl(): string {
  return (process.env.CLEEXS_API_URL || '').trim().replace(/\/$/, '');
}

async function fetchSnapshotEndpoint(domain: string): Promise<CleexsDataResult | null> {
  const base = baseUrl();
  const key = (process.env.CLEEXS_MARKETING_SERVICE_KEY || '').trim();
  if (!base || !key) return null;
  try {
    const res = await fetch(`${base}/api/marketing/snapshot?domain=${encodeURIComponent(domain)}`, {
      headers: { 'x-cleexs-service-key': key },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const snapshot = (await res.json()) as CleexsSnapshot;
    return { configured: true, snapshot };
  } catch {
    return null;
  }
}

type Json = Record<string, unknown>;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function topEntries(result: Json): Array<{ name: string; position: number; type?: string }> {
  const raw = result.manualOverride ? result.overrideTop3Json ?? result.top3Json : result.top3Json;
  return asArray<{ name?: string; position?: number; type?: string }>(raw)
    .filter((e) => typeof e?.name === 'string')
    .map((e) => ({ name: e.name as string, position: Number(e.position ?? 99), type: e.type }));
}

function intentionOf(prompt: Json | undefined): string {
  const category = (prompt?.category ?? null) as { name?: string } | null;
  if (category?.name) return category.name;
  const name = typeof prompt?.name === 'string' ? prompt.name : '';
  const parsed = name.split(' - ')[0]?.split(' (')[0]?.trim();
  return parsed || 'Sin intención';
}

function shortPrompt(prompt: Json | undefined): string {
  const text = typeof prompt?.promptText === 'string' ? prompt.promptText : '';
  const firstLine = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' ');
  return (firstLine || (typeof prompt?.name === 'string' ? prompt.name : 'Consulta')).slice(0, 220);
}

/** Arma el snapshot desde los endpoints actuales de Cleexs (marca + runs + resultados). */
async function fetchLegacySnapshot(brandId: string): Promise<CleexsDataResult | null> {
  const base = baseUrl();
  if (!base || !brandId) return null;
  try {
    const brandRes = await fetch(`${base}/api/brands/${encodeURIComponent(brandId)}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!brandRes.ok) return null;
    const brand = (await brandRes.json()) as Json;

    const runsRes = await fetch(
      `${base}/api/runs?brandId=${encodeURIComponent(brandId)}&primaryOnly=1`,
      { signal: AbortSignal.timeout(20_000) },
    );
    const runs = runsRes.ok ? asArray<Json>(await runsRes.json()) : [];
    const sorted = [...runs].sort(
      (a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime(),
    );
    const history = sorted.map((run) => {
      const report = asArray<Json>(run.priaReports)[0];
      return {
        runId: String(run.id),
        status: String(run.status ?? ''),
        runType: String(run.runType ?? ''),
        createdAt: String(run.createdAt ?? ''),
        cleexsScore: typeof report?.priaTotal === 'number' ? report.priaTotal : null,
        resultsCount: asArray(run.promptResults).length,
      };
    });

    const brandNames = new Set(
      [String(brand.name ?? ''), ...asArray<Json>(brand.aliases).map((a) => String(a.name ?? ''))]
        .map((n) => n.toLowerCase())
        .filter(Boolean),
    );
    const isBrand = (name: string, type?: string) =>
      type === 'brand' || brandNames.has(name.toLowerCase());

    let latest: CleexsSnapshot['latest'] = null;
    const latestCompleted = sorted.find((r) => r.status === 'completed') ?? sorted[0];
    if (latestCompleted) {
      const detailRes = await fetch(`${base}/api/runs/${encodeURIComponent(String(latestCompleted.id))}`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as Json;
        const results = asArray<Json>(detail.promptResults);
        const report = asArray<Json>(detail.priaReports)[0];
        let inTop3 = 0;
        let position1 = 0;
        const weakPrompts: NonNullable<CleexsSnapshot['latest']>['weakPrompts'] = [];
        const competitorMap = new Map<string, { appearances: number; positions: number[] }>();
        const intentionScores = new Map<string, number[]>();

        for (const result of results) {
          const prompt = (result.prompt ?? {}) as Json;
          const intention = intentionOf(prompt);
          const scoreRaw = typeof result.score === 'number' ? result.score : 0;
          const score = scoreRaw <= 1 ? scoreRaw * 100 : scoreRaw;
          intentionScores.set(intention, [...(intentionScores.get(intention) ?? []), score]);
          const top = topEntries(result);
          const mine = top.find((e) => isBrand(e.name, e.type));
          if (mine) {
            inTop3 += 1;
            if (mine.position === 1) position1 += 1;
          } else if (top.length > 0) {
            weakPrompts.push({
              prompt: shortPrompt(prompt),
              intention,
              score,
              top: top.slice(0, 3).map((e) => e.name),
            });
          }
          for (const entry of top) {
            if (isBrand(entry.name, entry.type)) continue;
            const agg = competitorMap.get(entry.name) ?? { appearances: 0, positions: [] };
            agg.appearances += 1;
            agg.positions.push(entry.position);
            competitorMap.set(entry.name, agg);
          }
        }

        const byCategory = (report?.priaByCategoryJson ?? null) as Record<string, number> | null;
        const scoreByIntention =
          byCategory && Object.keys(byCategory).some((k) => k !== 'uncategorized')
            ? Object.entries(byCategory).map(([intention, score]) => ({ intention, score: Number(score) }))
            : [...intentionScores.entries()].map(([intention, scores]) => ({
                intention,
                score: Math.round((scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)) * 100) / 100,
              }));

        latest = {
          runId: String(detail.id),
          createdAt: String(detail.createdAt ?? ''),
          cleexsScore: typeof report?.priaTotal === 'number' ? report.priaTotal : null,
          promptsAnalyzed: results.length,
          brandInTop3: inTop3,
          brandInTop3Pct: results.length ? Math.round((inTop3 / results.length) * 1000) / 10 : 0,
          brandPosition1: position1,
          competitorMentions: [...competitorMap.entries()]
            .map(([name, agg]) => ({
              name,
              appearances: agg.appearances,
              averagePosition: Math.round((agg.positions.reduce((a, b) => a + b, 0) / agg.positions.length) * 10) / 10,
            }))
            .sort((a, b) => b.appearances - a.appearances)
            .slice(0, 12),
          scoreByIntention: scoreByIntention.sort((a, b) => a.score - b.score),
          weakPrompts: weakPrompts.sort((a, b) => a.score - b.score).slice(0, 12),
        };
      }
    }

    const snapshot: CleexsSnapshot = {
      source: 'cleexs',
      generatedAt: new Date().toISOString(),
      brand: {
        id: String(brand.id),
        tenantId: String(brand.tenantId ?? ''),
        name: String(brand.name ?? ''),
        domain: (brand.domain as string | null) ?? null,
        industry: (brand.industry as string | null) ?? null,
        productType: (brand.productType as string | null) ?? null,
        country: (brand.country as string | null) ?? null,
        category: (brand.category as string | null) ?? null,
        objective: (brand.objective as string | null) ?? null,
        description: (brand.description as string | null) ?? null,
        aliases: asArray<Json>(brand.aliases).map((a) => String(a.name ?? '')).filter(Boolean),
        competitors: asArray<Json>(brand.competitors).map((c) => ({
          id: String(c.id ?? ''),
          name: String(c.name ?? ''),
          domain: (c.domain as string | null) ?? null,
          category: (c.category as string | null) ?? null,
          validated: Boolean(c.validated),
        })),
      },
      cleexsScore: latest?.cleexsScore ?? history.find((h) => h.cleexsScore !== null)?.cleexsScore ?? null,
      latest,
      history: history.slice(0, 12),
    };
    return { configured: true, snapshot };
  } catch {
    return null;
  }
}

export async function fetchCleexsSnapshot(workspaceId: string): Promise<CleexsDataResult> {
  if (!baseUrl()) {
    return { configured: false, reason: 'Falta configurar la conexión con Cleexs (CLEEXS_API_URL).' };
  }
  const domain = await workspaceDomain(workspaceId);
  if (domain) {
    const viaSnapshot = await fetchSnapshotEndpoint(domain);
    if (viaSnapshot) return viaSnapshot;
  }
  const brandId = (process.env.CLEEXS_BRAND_ID || '').trim();
  if (brandId) {
    const viaLegacy = await fetchLegacySnapshot(brandId);
    if (viaLegacy) return viaLegacy;
  }
  if (!domain && !brandId) {
    return { configured: false, reason: 'Este workspace no tiene dominio ni marca de Cleexs asociada.' };
  }
  if (domain) {
    return { configured: false, reason: `Cleexs no tiene una marca registrada para ${domain}. Se crea con el diagnóstico de marca de Cleexs.` };
  }
  return { configured: false, reason: 'No se pudo contactar a la API de Cleexs para traer los datos.' };
}
