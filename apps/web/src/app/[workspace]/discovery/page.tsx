'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Sparkles, Target } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import { getStoredUser } from '@/lib/auth-client';
import {
  fetchDiscoveryStatus,
  fetchOpportunities,
  runDiscoveryExplore,
  type KeywordOpportunity,
} from '@/lib/api-client';
import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';

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
      : 'Plataforma para conseguir clientes desde ChatGPT y medir visibilidad en IA',
  );
  const [seedsInput, setSeedsInput] = useState(
    workspace === 'empleados'
      ? 'marca empleadora\natracción de talento\nemployer branding\nreclutamiento con IA'
      : 'agentes de IA\nvisibilidad en IA\nconseguir clientes con ChatGPT\nAEO para pymes',
  );
  const [market, setMarket] = useState('latam');
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [top, setTop] = useState<
    Array<{
      topic: string;
      primaryQuery: string;
      opportunityScore: number;
      monthlySearches: number | null;
      suggestedAngle: string;
      cluster: string;
    }>
  >([]);
  const [recent, setRecent] = useState<KeywordOpportunity[]>([]);

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
        .slice(0, 15);
      setRecent(discoveryRows);
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
        maxCandidates: 40,
      });
      setTop(res.top ?? []);
      setMessage(
        `Listo (${res.mode}): ${res.briefs} briefs · +${res.created} / ~${res.updated} · cost≈$${res.cost.toFixed(4)}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al explorar');
    } finally {
      setRunning(false);
    }
  }

  return (
    <CentroShell workspaceName={workspaceName}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-violet-300">
            Agente Discovery
          </p>
          <h2 className="mt-1 text-3xl font-semibold text-white">Discovery</h2>
          <p className="mt-2 max-w-2xl text-sm text-hub-muted">
            Descubre qué busca el mercado (DataForSEO + score). Teo no inventa temas: consume estos
            briefs desde Oportunidades.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-hub-border bg-hub-card px-3 py-2 text-sm text-slate-200 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" /> Recargar
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">
        <strong className="text-white">Estado:</strong>{' '}
        {configured
          ? `DataForSEO conectado · modo ${mode}`
          : 'Falta DATAFORSEO_LOGIN / PASSWORD en la API'}
        {' · '}
        <Link href={workspaceHref(workspace, 'oportunidades')} className="underline hover:text-white">
          Ver cola en Oportunidades
        </Link>
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
          Semillas (una por línea)
          <textarea
            value={seedsInput}
            onChange={(e) => setSeedsInput(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white outline-none ring-violet-500/40 focus:ring-2"
          />
        </label>
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

      {top.length > 0 ? (
        <section className="mb-6 overflow-hidden rounded-2xl border border-hub-border bg-hub-card">
          <div className="border-b border-hub-border px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Top briefs de esta corrida</h3>
          </div>
          <ul className="divide-y divide-hub-border/70">
            {top.map((b) => (
              <li key={b.primaryQuery} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-white">{b.primaryQuery}</p>
                  <p className="text-sm tabular-nums text-violet-200">Opp {b.opportunityScore}</p>
                </div>
                <p className="mt-1 text-xs text-hub-muted">
                  {b.cluster}
                  {b.monthlySearches != null ? ` · vol ${b.monthlySearches}` : ''}
                </p>
                <p className="mt-1 text-sm text-slate-300">{b.suggestedAngle}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-hub-border bg-hub-card">
        <div className="flex items-center justify-between border-b border-hub-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-cleexs-blue" />
            <h3 className="text-sm font-semibold text-white">Últimas oportunidades de Discovery</h3>
          </div>
          <Link
            href={workspaceHref(workspace, 'oportunidades')}
            className="text-xs text-cleexs-blue hover:underline"
          >
            Abrir radar completo
          </Link>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-sm text-hub-muted">Cargando…</p>
        ) : recent.length === 0 ? (
          <p className="px-4 py-8 text-sm text-hub-muted">
            Todavía no hay briefs. Corré Discovery arriba.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#0b1220]/60 text-xs uppercase tracking-wide text-hub-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Keyword</th>
                  <th className="px-4 py-3 font-medium">Vol</th>
                  <th className="px-4 py-3 font-medium">Opp</th>
                  <th className="px-4 py-3 font-medium">Fuente</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id} className="border-t border-hub-border/70">
                    <td className="px-4 py-3 text-slate-100">
                      <div className="font-medium">{row.keyword}</div>
                      <div className="text-xs text-hub-muted">{row.cluster}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">
                      {row.monthlySearches ?? '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-violet-200">
                      {row.opportunityScore ?? row.priority}
                    </td>
                    <td className="px-4 py-3 text-xs text-hub-muted">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </CentroShell>
  );
}
