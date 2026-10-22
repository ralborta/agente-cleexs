import { prisma } from '../prisma';

/**
 * Datos reales de Cleexs (marca, competidores, Cleexs Score, consultas por intención)
 * vía GET /api/marketing/snapshot de la API de Cleexs (Railway), server-to-server.
 * Si falta configuración o Cleexs no responde, devuelve configured:false — nunca datos inventados.
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

export async function fetchCleexsSnapshot(workspaceId: string): Promise<CleexsDataResult> {
  const base = (process.env.CLEEXS_API_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.CLEEXS_MARKETING_SERVICE_KEY || '').trim();
  if (!base || !key) {
    return { configured: false, reason: 'Falta configurar la conexión con Cleexs (CLEEXS_API_URL / CLEEXS_MARKETING_SERVICE_KEY).' };
  }
  const domain = await workspaceDomain(workspaceId);
  if (!domain) {
    return { configured: false, reason: 'Este workspace no tiene dominio de marca asociado para buscar en Cleexs.' };
  }
  try {
    const res = await fetch(`${base}/api/marketing/snapshot?domain=${encodeURIComponent(domain)}`, {
      headers: { 'x-cleexs-service-key': key },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 404) {
      return { configured: false, reason: `Cleexs no tiene una marca registrada para ${domain}. Se crea con el diagnóstico de marca de Cleexs.` };
    }
    if (!res.ok) {
      return { configured: false, reason: `Cleexs respondió ${res.status} al pedir los datos de ${domain}.` };
    }
    const snapshot = (await res.json()) as CleexsSnapshot;
    return { configured: true, snapshot };
  } catch {
    return { configured: false, reason: 'No se pudo contactar a la API de Cleexs para traer los datos.' };
  }
}
