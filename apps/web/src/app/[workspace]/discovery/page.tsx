'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Youtube,
  Search,
} from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import { YoutubeInterestChart } from '@/components/discovery/youtube-interest-chart';
import { MetricsKpiCard } from '@/components/metrics/metrics-kpi-card';
import { getStoredUser } from '@/lib/auth-client';
import {
  fetchDiscoveryStatus,
  fetchOpportunities,
  runDiscoveryExplore,
  type KeywordOpportunity,
} from '@/lib/api-client';
import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';
import { cn } from '@/lib/utils';

type YoutubeBrief = {
  interest?: number | null;
  trend?: string;
  interestGraph?: Array<{ dateFrom?: string | null; dateTo?: string | null; value?: number | null }>;
  relatedQueries?: Array<{ query: string; value: string; kind: 'top' | 'rising' }>;
  relatedTopics?: Array<{ title: string; value: string; kind: 'top' | 'rising' }>;
  topVideos?: Array<{
    title: string;
    videoId: string;
    url?: string | null;
    channelName?: string | null;
    views?: number | null;
  }>;
  topChannels?: Array<{
    name: string;
    videoCount: number;
    totalViews: number;
  }>;
  contentPatterns?: string[];
};

type BriefShape = {
  channels?: Array<'google' | 'youtube'>;
  suggestedAngle?: string;
  relatedQueries?: string[];
  sources?: {
    google?: {
      monthlySearches?: number | null;
      demandScore?: number;
      trendLabel?: string;
    };
    youtube?: YoutubeBrief;
  };
};

function readBrief(row: KeywordOpportunity): BriefShape {
  return (row.brief && typeof row.brief === 'object' ? row.brief : {}) as BriefShape;
}

function formatViews(n: number | null | undefined) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function DiscoveryPage() {
  const workspace = useWorkspaceSlug();
  const workspaceName =
    getStoredUser()?.workspaceName || getStoredUser()?.workspaceSlug || 'Workspace';

  const [configured, setConfigured] = useState(false);
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox');
  const [siteUrl, setSiteUrl] = useState(
    workspace === 'empleados' ? 'https://empliados.net' : 'https://cleexs.net',
  );
  const [description, setDescription] = useState(
    workspace === 'empleados'
      ? 'Plataforma de marca empleadora y atracción de talento'
      : 'Plataforma de agentes IA especializados en Logística',
  );
  const [seedsInput, setSeedsInput] = useState(
    workspace === 'empleados'
      ? 'marca empleadora\natracción de talento\nemployer branding\nreclutamiento con IA'
      : 'agentes de IA\nlogística con IA\nvisibilidad en IA\nAEO para pymes',
  );
  const [market, setMarket] = useState('latam');
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recent, setRecent] = useState<KeywordOpportunity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [status, opps] = await Promise.all([
        fetchDiscoveryStatus(workspace),
        fetchOpportunities(workspace),
      ]);
      setConfigured(status.configured);
      setMode(status.mode);
      if (status.settings?.siteUrl) setSiteUrl(status.settings.siteUrl);
      if (status.settings?.description) setDescription(status.settings.description);
      if (status.settings?.market) setMarket(status.settings.market);
      if (Array.isArray(status.seeds) && status.seeds.length) {
        setSeedsInput(status.seeds.join('\n'));
      }
      const discoveryRows = (opps.opportunities ?? [])
        .filter((r) => r.source.startsWith('discovery_') || r.opportunityScore != null)
        .sort(
          (a, b) =>
            (b.opportunityScore ?? b.priority) - (a.opportunityScore ?? a.priority),
        )
        .slice(0, 40);
      setRecent(discoveryRows);
      setSelectedId((prev) => {
        if (prev && discoveryRows.some((r) => r.id === prev)) return prev;
        return discoveryRows[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar Discovery');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExplore() {
    const seeds = seedsInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!seeds.length) {
      setError('Agregá al menos una keyword semilla.');
      return;
    }
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const res = await runDiscoveryExplore(workspace, {
        siteUrl: siteUrl.trim(),
        description: description.trim(),
        market,
        seeds,
        includeSiteKeywords: false,
        deepExpand: true,
        includeYoutube: true,
        youtubeMaxKeywords: 8,
        maxCandidates: 80,
      });
      setMessage(
        `Listo (${res.mode}): pool ${res.pool ?? '—'} → ${res.candidates} candidatos → ${res.briefs} briefs${typeof res.youtubeEnriched === 'number' ? ` · YT ${res.youtubeEnriched}` : ''} · +${res.created} / ~${res.updated} · cost≈$${res.cost.toFixed(4)}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al explorar');
    } finally {
      setRunning(false);
    }
  }

  const selected = useMemo(
    () => recent.find((r) => r.id === selectedId) ?? recent[0] ?? null,
    [recent, selectedId],
  );
  const selectedBrief = selected ? readBrief(selected) : null;
  const yt = selectedBrief?.sources?.youtube;

  const kpis = useMemo(() => {
    const withYt = recent.filter((r) => {
      const b = readBrief(r);
      return b.channels?.includes('youtube') || Boolean(b.sources?.youtube);
    }).length;
    const both = recent.filter((r) => {
      const ch = readBrief(r).channels ?? [];
      return ch.includes('google') && ch.includes('youtube');
    }).length;
    const interests = recent
      .map((r) => readBrief(r).sources?.youtube?.interest)
      .filter((v): v is number => typeof v === 'number');
    const avgInterest = interests.length
      ? Math.round(interests.reduce((a, b) => a + b, 0) / interests.length)
      : 0;
    return {
      total: recent.length,
      withYt,
      both,
      avgInterest,
    };
  }, [recent]);

  return (
    <CentroShell workspaceName={workspaceName}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
            <Sparkles className="h-3.5 w-3.5" />
            Agente Discovery · mercado
          </div>
          <h2 className="text-3xl font-semibold text-white">Dashboard Discovery</h2>
          <p className="mt-2 max-w-2xl text-sm text-hub-muted">
            Señales Google + YouTube (SERP y Trends) sobre tus topics. No publica contenido: alimenta
            la cola de Oportunidades para Teo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-hub-border bg-hub-card px-3 py-2 text-sm text-slate-200 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" /> Recargar
          </button>
          <Link
            href={workspaceHref(workspace, 'oportunidades')}
            className="inline-flex items-center gap-2 rounded-xl border border-hub-border bg-hub-card px-3 py-2 text-sm text-cleexs-blue hover:underline"
          >
            <Target className="h-4 w-4" /> Oportunidades
          </Link>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">
        <strong className="text-white">Estado:</strong>{' '}
        {configured
          ? `DataForSEO conectado · modo ${mode}`
          : 'Falta DATAFORSEO_LOGIN / PASSWORD en la API'}
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricsKpiCard label="Oportunidades" value={kpis.total} accent="violet" hint="Discovery en cola" />
        <MetricsKpiCard label="Con YouTube" value={kpis.withYt} accent="orange" hint="SERP o Trends YT" />
        <MetricsKpiCard label="Google + YT" value={kpis.both} accent="teal" hint="Presencia en ambos" />
        <MetricsKpiCard
          label="Interest YT medio"
          value={kpis.avgInterest}
          accent="blue"
          hint="Trends type=youtube (0–100)"
        />
      </div>

      <section className="mb-6 rounded-2xl border border-violet-500/30 bg-hub-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-semibold text-white">Explorar mercado</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-hub-muted">
            Sitio
            <input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="mt-1 w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-hub-muted">
            Mercado
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="mt-1 w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white"
            >
              <option value="latam">Latam (proxy Argentina)</option>
              <option value="ar">Argentina</option>
              <option value="mx">México</option>
              <option value="co">Colombia</option>
              <option value="es">España</option>
            </select>
          </label>
          <label className="block text-xs text-hub-muted sm:col-span-2">
            Descripción del negocio
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-hub-muted">
          Semillas / topics (una por línea)
          <textarea
            value={seedsInput}
            onChange={(e) => setSeedsInput(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white outline-none ring-violet-500/40 focus:ring-2"
          />
        </label>
        <p className="mt-2 text-xs text-hub-muted">
          Google (Ads + Labs) → score → YouTube SERP + Trends sobre el top 8. Puede tardar 1–3 min.
        </p>
        <button
          type="button"
          disabled={running || !configured}
          onClick={handleExplore}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {running ? 'Discovery corriendo…' : 'Correr Discovery'}
        </button>
      </section>

      {loading ? (
        <p className="text-sm text-hub-muted">Cargando dashboard…</p>
      ) : recent.length === 0 ? (
        <p className="rounded-2xl border border-hub-border bg-hub-card px-4 py-10 text-center text-sm text-hub-muted">
          Todavía no hay oportunidades. Corré Discovery arriba.
        </p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
          <section className="overflow-hidden rounded-2xl border border-hub-border bg-hub-card">
            <div className="border-b border-hub-border px-4 py-3">
              <h3 className="text-sm font-semibold text-white">Oportunidades</h3>
              <p className="text-xs text-hub-muted">Elegí una para ver Google + YouTube</p>
            </div>
            <ul className="max-h-[640px] divide-y divide-hub-border/70 overflow-y-auto">
              {recent.map((row) => {
                const brief = readBrief(row);
                const channels = brief.channels ?? ['google'];
                const active = row.id === selected?.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={cn(
                        'w-full px-4 py-3 text-left transition',
                        active ? 'bg-violet-500/15' : 'hover:bg-[#0b1220]/50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-white">{row.keyword}</p>
                        <p className="shrink-0 text-sm tabular-nums text-violet-200">
                          {row.opportunityScore ?? row.priority}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-hub-muted">{row.cluster}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {channels.map((ch) => (
                          <span
                            key={ch}
                            className="rounded-md border border-hub-border bg-[#0b1220] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300"
                          >
                            {ch === 'youtube' ? 'YouTube' : 'Google'}
                          </span>
                        ))}
                        {row.monthlySearches != null ? (
                          <span className="text-[10px] text-hub-muted">vol {row.monthlySearches}</span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="space-y-6">
            {selected ? (
              <>
                <section className="rounded-2xl border border-hub-border bg-hub-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-hub-muted">
                        Oportunidad seleccionada
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-white">{selected.keyword}</h3>
                      <p className="mt-1 text-sm text-hub-muted">{selected.cluster}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold tabular-nums text-violet-200">
                        {selected.opportunityScore ?? selected.priority}
                      </p>
                      <p className="text-xs text-hub-muted">Opportunity score</p>
                    </div>
                  </div>
                  {selectedBrief?.suggestedAngle ? (
                    <p className="mt-4 text-sm text-slate-300">{selectedBrief.suggestedAngle}</p>
                  ) : null}
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-hub-muted">Google vol</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {selected.monthlySearches ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-hub-muted">YT interest</p>
                      <p className="mt-1 text-lg font-semibold text-white">{yt?.interest ?? '—'}</p>
                    </div>
                    <div className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-hub-muted">YT trend</p>
                      <p className="mt-1 text-lg font-semibold capitalize text-white">
                        {yt?.trend ?? '—'}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
                  <section className="rounded-2xl border border-hub-border bg-hub-card p-6 shadow-hub">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Interés YouTube (12 meses)</h3>
                        <p className="mt-1 text-sm text-hub-muted">
                          Google Trends · type=youtube · misma lectura que el Explore dashboard
                        </p>
                      </div>
                      <Youtube className="h-5 w-5 text-rose-400" />
                    </div>
                    <YoutubeInterestChart data={yt?.interestGraph ?? []} />
                  </section>

                  <section className="rounded-2xl border border-hub-border bg-hub-card p-5 shadow-hub">
                    <div className="mb-4 flex items-center gap-2">
                      <Search className="h-4 w-4 text-cleexs-blue" />
                      <h3 className="text-sm font-semibold text-white">Google (brief)</h3>
                    </div>
                    <div className="space-y-2 text-sm text-slate-300">
                      <p>
                        Demanda {selected.demandScore ?? '—'} · Tendencia{' '}
                        {selectedBrief?.sources?.google?.trendLabel ?? selected.trendScore ?? '—'}
                      </p>
                      {(selectedBrief?.relatedQueries ?? []).length > 0 ? (
                        <ul className="space-y-1.5">
                          {selectedBrief!.relatedQueries!.slice(0, 8).map((q) => (
                            <li
                              key={q}
                              className="rounded-lg border border-hub-border/50 bg-[#0b1220]/40 px-3 py-2 text-xs"
                            >
                              {q}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-hub-muted">Sin related queries en el brief.</p>
                      )}
                    </div>
                  </section>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-2xl border border-hub-border bg-hub-card p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Youtube className="h-4 w-4 text-rose-400" />
                      <h3 className="text-sm font-semibold text-white">Related queries (YouTube)</h3>
                    </div>
                    {!yt ? (
                      <p className="text-sm text-hub-muted">
                        Sin datos YouTube. Corré Discovery de nuevo (corridas viejas no lo tienen).
                      </p>
                    ) : (yt.relatedQueries ?? []).length ? (
                      <ul className="space-y-1.5">
                        {yt.relatedQueries!.slice(0, 12).map((q) => (
                          <li
                            key={`${q.kind}-${q.query}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-hub-border/50 bg-[#0b1220]/40 px-3 py-2 text-xs"
                          >
                            <span className="text-slate-200">{q.query}</span>
                            <span className="shrink-0 text-hub-muted">
                              {q.kind} · {q.value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-hub-muted">Sin related queries YT.</p>
                    )}
                  </section>

                  <section className="rounded-2xl border border-hub-border bg-hub-card p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Youtube className="h-4 w-4 text-rose-400" />
                      <h3 className="text-sm font-semibold text-white">Related topics (YouTube)</h3>
                    </div>
                    {!yt ? (
                      <p className="text-sm text-hub-muted">Sin datos YouTube todavía.</p>
                    ) : (yt.relatedTopics ?? []).length ? (
                      <ul className="space-y-1.5">
                        {yt.relatedTopics!.slice(0, 12).map((t) => (
                          <li
                            key={`${t.kind}-${t.title}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-hub-border/50 bg-[#0b1220]/40 px-3 py-2 text-xs"
                          >
                            <span className="text-slate-200">{t.title}</span>
                            <span className="shrink-0 text-hub-muted">
                              {t.kind} · {t.value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-hub-muted">Sin related topics YT para esta keyword.</p>
                    )}
                  </section>
                </div>

                <section className="rounded-2xl border border-hub-border bg-hub-card p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-rose-300" />
                    <h3 className="text-sm font-semibold text-white">Top videos YouTube (SERP)</h3>
                  </div>
                  {!yt?.topVideos?.length ? (
                    <p className="text-sm text-hub-muted">Sin videos en SERP para esta keyword.</p>
                  ) : (
                    <div className="space-y-3">
                      {yt.topVideos.slice(0, 8).map((v, index) => (
                        <div
                          key={v.videoId || `${v.title}-${index}`}
                          className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white">{v.title}</p>
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-hub-muted">
                                <span>{v.channelName || 'Canal —'}</span>
                                <span>{formatViews(v.views)} views</span>
                              </div>
                            </div>
                            {v.url || v.videoId ? (
                              <a
                                href={v.url || `https://www.youtube.com/watch?v=${v.videoId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 text-xs font-semibold text-cleexs-blue hover:underline"
                              >
                                Ver →
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {yt?.topChannels?.length ? (
                  <section className="rounded-2xl border border-hub-border bg-hub-card p-5">
                    <h3 className="mb-4 text-sm font-semibold text-white">Canales que aparecen</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {yt.topChannels.slice(0, 6).map((ch) => (
                        <div
                          key={ch.name}
                          className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 p-3"
                        >
                          <p className="text-sm font-medium text-white">{ch.name}</p>
                          <p className="mt-1 text-xs text-hub-muted">
                            {ch.videoCount} videos en SERP · {formatViews(ch.totalViews)} views acum.
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      )}
    </CentroShell>
  );
}
