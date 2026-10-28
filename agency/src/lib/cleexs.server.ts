import { appearancesOf, computeMentions, keyOf, displayName, pct, visibilityOf } from './metrics';
import type {
  AgencySnapshot,
  BrandInfo,
  PromptRow,
  RunSummary,
  Top3Entry,
} from './types';

export const DEFAULT_BRAND_ID = 'c1a58b9e-dc6d-479b-8930-70208e6f813e';
const MAX_RUNS = 12;

export function cleexsApiUrl(): string {
  return (process.env.CLEEXS_API_URL || 'https://cleexsapi-production.up.railway.app').replace(/\/+$/, '');
}
export function cleexsBrandId(): string {
  return (process.env.CLEEXS_BRAND_ID || DEFAULT_BRAND_ID).trim();
}

async function getJson<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${cleexsApiUrl()}${path}`, {
    headers: { accept: 'application/json', ...headers },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Cleexs API ${res.status} en ${path}`);
  return (await res.json()) as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function modelLabel(model: string | null): string {
  if (!model) return 'Desconocido';
  const m = model.toLowerCase();
  if (m.includes('gpt') || m.includes('openai') || m.startsWith('o1') || m.startsWith('o3')) return 'ChatGPT';
  if (m.includes('claude')) return 'Claude';
  if (m.includes('gemini')) return 'Gemini';
  if (m.includes('sonar') || m.includes('perplexity')) return 'Perplexity';
  return model;
}

function parseTop3(raw: unknown, brandKeys: Set<string>): Top3Entry[] {
  if (!Array.isArray(raw)) return [];
  const out: Top3Entry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object' || typeof (e as any).name !== 'string') continue;
    const name = (e as any).name as string;
    const position = Number((e as any).position) || out.length + 1;
    const isBrand = (e as any).type === 'brand' || brandKeys.has(keyOf(name));
    out.push({
      name,
      position,
      type: isBrand ? 'brand' : (e as any).type === 'competitor' ? 'competitor' : 'other',
    });
  }
  return out.sort((a, b) => a.position - b.position);
}

function toPromptRow(r: any, brandKeys: Set<string>, model: string | null, withExcerpt: boolean): PromptRow {
  const top3 = parseTop3(r.manualOverride && r.overrideTop3Json ? r.overrideTop3Json : r.top3Json, brandKeys);
  const name: string = r.prompt?.name ?? '';
  const [intent, type] = name.includes(' - ') ? name.split(' - ').map((s: string) => s.trim()) : [null, name || null];
  const brandEntry = top3.find((e) => e.type === 'brand');
  return {
    id: r.id,
    promptId: r.promptId,
    name,
    text: r.prompt?.promptText ?? '',
    intent: intent ?? null,
    type: type ?? null,
    top3,
    brandInTop3: !!brandEntry,
    brandPosition: brandEntry?.position ?? null,
    score: typeof r.score === 'number' ? r.score : 0,
    model,
    ...(withExcerpt && typeof r.responseText === 'string'
      ? { responseExcerpt: r.responseText.slice(0, 700) }
      : {}),
  };
}

function toRunSummary(run: any, detail: any, brandKeys: Set<string>, withExcerpt: boolean): RunSummary {
  const model: string | null = run.modelMeta?.model ?? null;
  const prompts: PromptRow[] = (detail?.promptResults ?? []).map((r: any) =>
    toPromptRow(r, brandKeys, model, withExcerpt),
  );
  const brandInTop3 = prompts.filter((p) => p.brandInTop3).length;
  return {
    id: run.id,
    createdAt: run.createdAt,
    periodStart: run.periodStart ?? null,
    periodEnd: run.periodEnd ?? null,
    runType: run.runType,
    status: run.status,
    country: run.country ?? null,
    model,
    promptsAnalyzed: prompts.length,
    brandInTop3,
    visibilityPct: visibilityOf(prompts),
    appearances: appearancesOf(prompts),
    prompts,
  };
}

export async function buildSnapshot(): Promise<AgencySnapshot> {
  const brandId = cleexsBrandId();
  const warnings: string[] = [];

  const rawBrand = await getJson<any>(`/api/brands/${brandId}`);
  const aliases: string[] = (rawBrand.aliases ?? []).map((a: any) => (typeof a === 'string' ? a : a.alias)).filter(Boolean);
  const brand: BrandInfo = {
    id: rawBrand.id,
    name: rawBrand.name,
    domain: rawBrand.domain ?? null,
    country: rawBrand.country ?? null,
    industry: rawBrand.industry ?? null,
    aliases,
    competitors: (rawBrand.competitors ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      displayName: displayName(c.name),
      domain: c.domain ?? null,
      validated: !!c.validated,
    })),
  };
  const brandKeys = new Set([brand.name, ...aliases].map(keyOf));

  let runs: any[] = [];
  try {
    runs = await getJson<any[]>(`/api/runs?brandId=${brandId}&primaryOnly=1`);
    if (!runs.length) runs = await getJson<any[]>(`/api/runs?brandId=${brandId}`);
  } catch (e) {
    warnings.push(`No se pudieron leer corridas: ${(e as Error).message}`);
  }
  runs = runs
    .filter((r) => r.status === 'completed' || r.status === undefined)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, MAX_RUNS);

  const details = await Promise.all(
    runs.map((r) =>
      getJson<any>(`/api/runs/${r.id}`).catch((e) => {
        warnings.push(`Corrida ${r.id}: ${(e as Error).message}`);
        return null;
      }),
    ),
  );

  const summaries = runs.map((r, i) => toRunSummary(r, details[i], brandKeys, i === 0));
  const latestRun = summaries[0] ?? null;
  const history = [...summaries].reverse();

  const latestPria: number | null = runs[0]?.priaReports?.[0]?.priaTotal ?? null;

  let visibilityPct: number | null = null;
  let visibilitySource: AgencySnapshot['visibilitySource'] = 'none';
  if (latestRun && latestRun.promptsAnalyzed > 0) {
    visibilityPct = latestRun.visibilityPct;
    visibilitySource = 'brandInTop3Pct';
  } else if (latestRun) {
    const scores = latestRun.prompts.map((p) => p.score);
    if (scores.length) {
      visibilityPct = (scores.reduce((a, b) => a + b, 0) / scores.length) * 100;
      visibilitySource = 'score';
    }
  }

  // Opcional: snapshot de marketing (server-to-server)
  let priaTotal = latestPria;
  const mkKey = (process.env.CLEEXS_MARKETING_SERVICE_KEY || '').trim();
  if (mkKey) {
    try {
      const mk = await getJson<any>(`/api/marketing/snapshot?brandId=${brandId}`, {
        'x-cleexs-service-key': mkKey,
      });
      if (typeof mk?.cleexsScore === 'number') priaTotal = mk.cleexsScore;
      if (visibilityPct === null && typeof mk?.latest?.brandInTop3Pct === 'number') {
        visibilityPct = mk.latest.brandInTop3Pct;
        visibilitySource = 'brandInTop3Pct';
      }
    } catch (e) {
      warnings.push(`Marketing snapshot no disponible: ${(e as Error).message}`);
    }
  }

  const prompts = latestRun?.prompts ?? [];
  const mentions = computeMentions(prompts, brand);

  const weakPrompts = prompts
    .filter((p) => !p.brandInTop3)
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .map((p) => ({ prompt: p.text, type: p.type, score: p.score, top: p.top3.map((e) => displayName(e.name)) }));

  // LLMs: solo desde modelMeta.model de la última corrida (una corrida = un modelo)
  const llms: AgencySnapshot['llms'] = [];
  if (latestRun?.model) {
    llms.push({
      model: latestRun.model,
      label: modelLabel(latestRun.model),
      responses: latestRun.promptsAnalyzed,
      mentions: latestRun.brandInTop3,
      visibilityPct: pct(latestRun.brandInTop3, latestRun.promptsAnalyzed),
    });
  }

  if (!latestRun) warnings.push('La marca todavía no tiene corridas completadas en Cleexs.');

  return {
    source: 'cleexs',
    generatedAt: new Date().toISOString(),
    apiUrl: cleexsApiUrl(),
    brand,
    visibilityPct,
    visibilitySource,
    latestRun,
    competitorMentions: mentions.others,
    weakPrompts,
    history,
    prompts,
    llms,
    priaTotal,
    sources: [],
    sentiment: [],
    buyerPersonas: [],
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Portal auth + prompts propios + schedule (resultados reales)        */
/* ------------------------------------------------------------------ */

type PortalTokenCache = { token: string; exp: number };
let portalTokenCache: PortalTokenCache | null = null;

async function cleexsFetch<T>(
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<T> {
  const res = await fetch(`${cleexsApiUrl()}${path}`, {
    ...init,
    headers: { accept: 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const errMsg =
      body && typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : `Cleexs API ${res.status} en ${path}`;
    throw new Error(errMsg);
  }
  return body as T;
}

export async function getPortalToken(): Promise<string> {
  const email = (process.env.CLEEXS_PORTAL_EMAIL || '').trim();
  const password = (process.env.CLEEXS_PORTAL_PASSWORD || '').trim();
  if (!email || !password) {
    throw new Error(
      'Faltan CLEEXS_PORTAL_EMAIL / CLEEXS_PORTAL_PASSWORD en el servicio agency (EasyPanel).',
    );
  }
  const now = Date.now();
  if (portalTokenCache && portalTokenCache.exp > now + 60_000) return portalTokenCache.token;

  const data = await cleexsFetch<{ token: string; expiresInSeconds?: number }>('/api/auth/portal/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!data.token) throw new Error('Login portal Cleexs sin token');
  const ttlMs = Math.max(60, Number(data.expiresInSeconds || 3600) - 120) * 1000;
  portalTokenCache = { token: data.token, exp: now + ttlMs };
  return data.token;
}

export type CleexsSavedSlot = {
  slot: number;
  id: string | null;
  title: string;
  promptText: string;
  updatedAt: string | null;
  lastExecutedAt: string | null;
  resultsCount: number;
};

export type CleexsWeeklyPrompts = {
  brandId: string;
  runSchedule: 'semanal' | 'quincenal' | 'mensual' | null;
  selectedWeeklyPortalPromptId: string | null;
  maxSlots: number;
  slots: CleexsSavedSlot[];
};

export async function listWeeklyPrompts(): Promise<CleexsWeeklyPrompts> {
  const token = await getPortalToken();
  const brandId = cleexsBrandId();
  return cleexsFetch(`/api/portal/brands/${brandId}/weekly-prompts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function upsertWeeklyPrompt(slot: number, promptText: string) {
  const token = await getPortalToken();
  const brandId = cleexsBrandId();
  return cleexsFetch<{ ok: boolean; slot: number; id: string; title: string; promptText: string }>(
    `/api/portal/brands/${brandId}/weekly-prompts/${slot}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ promptText }),
    },
  );
}

export async function deleteWeeklyPrompt(slot: number) {
  const token = await getPortalToken();
  const brandId = cleexsBrandId();
  const res = await fetch(`${cleexsApiUrl()}/api/portal/brands/${brandId}/weekly-prompts/${slot}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok && res.status !== 204) {
    const t = await res.text();
    throw new Error(t || `Cleexs DELETE ${res.status}`);
  }
}

export async function selectWeeklyPrompt(savedPromptId: string | null) {
  const token = await getPortalToken();
  const brandId = cleexsBrandId();
  return cleexsFetch(`/api/portal/brands/${brandId}/weekly-prompts/selection`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ savedPromptId }),
  });
}

export type CleexsPromptExecution = {
  ok?: boolean;
  executionId?: string;
  createdAt?: string;
  responseText: string;
  analysis: unknown;
  totalTokens?: number;
  savedPrompt?: { id: string; slot: number; title: string; promptText: string };
  error?: string;
};

export async function executeWeeklyPrompt(savedPromptId: string): Promise<CleexsPromptExecution> {
  const token = await getPortalToken();
  const brandId = cleexsBrandId();
  return cleexsFetch(`/api/portal/brands/${brandId}/weekly-prompts/${savedPromptId}/execute`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export async function listWeeklyPromptResults(savedPromptId?: string) {
  const token = await getPortalToken();
  const brandId = cleexsBrandId();
  const path = savedPromptId
    ? `/api/portal/brands/${brandId}/weekly-prompts/${savedPromptId}/results`
    : `/api/portal/brands/${brandId}/weekly-prompts/results`;
  return cleexsFetch(path, { headers: { Authorization: `Bearer ${token}` } });
}

export type CleexsRunSchedule = 'semanal' | 'quincenal' | 'mensual' | null;

export async function getBrandRunSchedule(): Promise<{
  brandId: string;
  name: string;
  runSchedule: CleexsRunSchedule;
}> {
  const brandId = cleexsBrandId();
  const brand = await cleexsFetch<any>(`/api/brands/${brandId}`);
  return {
    brandId: brand.id,
    name: brand.name,
    runSchedule: (brand.runSchedule as CleexsRunSchedule) ?? null,
  };
}

export async function setBrandRunSchedule(runSchedule: CleexsRunSchedule): Promise<{
  id: string;
  name: string;
  runSchedule: CleexsRunSchedule;
}> {
  const brandId = cleexsBrandId();
  const brand = await cleexsFetch<{ id: string; name: string; runSchedule?: CleexsRunSchedule }>(
    `/api/brands/${brandId}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runSchedule }),
    },
  );
  return { id: brand.id, name: brand.name, runSchedule: brand.runSchedule ?? null };
}

/** Dispara una corrida real Cleexs (crea Run + execute). */
export async function triggerCleexsRun(opts?: {
  runType?: string;
  weeklyPortalSavedPromptId?: string | null;
  promptVersionId?: string;
}): Promise<{ runId: string; status: string; runType: string }> {
  const brandId = cleexsBrandId();
  const brand = await cleexsFetch<any>(`/api/brands/${brandId}`);
  const tenantId = brand.tenantId as string;
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)).toISOString();

  const runType = opts?.runType || (opts?.weeklyPortalSavedPromptId ? 'weekly_portal' : 'monthly');
  const run = await cleexsFetch<any>('/api/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      brandId,
      periodStart,
      periodEnd,
      runType,
      ...(opts?.weeklyPortalSavedPromptId
        ? { weeklyPortalSavedPromptId: opts.weeklyPortalSavedPromptId }
        : {}),
    }),
  });

  const execBody: Record<string, unknown> = { model: 'gpt-4o-mini', force: true };
  if (opts?.promptVersionId) execBody.promptVersionId = opts.promptVersionId;

  await cleexsFetch(`/api/runs/${run.id}/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(execBody),
  });

  return { runId: run.id, status: 'executing', runType };
}

/** Mapea cadencia Agency → Cleexs runSchedule. */
export function cadenceToCleexs(
  cadence: string,
  enabled: boolean,
): CleexsRunSchedule {
  if (!enabled) return null;
  if (cadence === 'Mensual') return 'mensual';
  if (cadence === 'Quincenal') return 'quincenal';
  if (cadence === 'Semanal' || cadence === 'Diaria') return 'semanal';
  return null; // Una vez → sin cron; usar Ejecutar ahora
}
