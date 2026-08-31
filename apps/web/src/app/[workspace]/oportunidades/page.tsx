'use client';

import { useWorkspaceSlug } from '@/lib/workspace';
import { getStoredUser } from '@/lib/auth-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Sparkles, Target, Trash2 } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import {
  deleteOpportunity,
  fetchDiscoveryStatus,
  fetchOpportunities,
  generateOpportunityQuestions,
  ingestOpportunitySeeds,
  runDiscoveryExplore,
  updateKeywordQuestion,
  updateOpportunity,
  type FunnelStage,
  type KeywordOpportunity,
  type KeywordOpportunityStatus,
  type KeywordQuestion,
  type KeywordQuestionStatus,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

const STAGE_META: Record<FunnelStage, { label: string; hint: string; className: string }> = {
  tofu: {
    label: 'TOFU',
    hint: 'Descubrimiento',
    className: 'bg-sky-500/15 text-sky-200 ring-sky-500/30',
  },
  mofu: {
    label: 'MOFU',
    hint: 'Evaluación',
    className: 'bg-violet-500/15 text-violet-200 ring-violet-500/30',
  },
  bofu: {
    label: 'BOFU',
    hint: 'Decisión',
    className: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
  },
};

const STATUS_LABEL: Record<KeywordOpportunityStatus, string> = {
  idea: 'Idea',
  queued: 'En cola',
  in_progress: 'En curso',
  covered: 'Cubierta',
  discarded: 'Descartada',
};

const QUESTION_STATUS: Record<KeywordQuestionStatus, string> = {
  idea: 'Idea',
  queued: 'En cola',
  in_progress: 'En curso',
  covered: 'Cubierta',
  discarded: 'Descartada',
};

export default function OportunidadesPage() {
  const workspace = useWorkspaceSlug();
  const workspaceName =
    getStoredUser()?.workspaceName || getStoredUser()?.workspaceSlug || 'Workspace';

  const [rows, setRows] = useState<KeywordOpportunity[]>([]);
  const [questions, setQuestions] = useState<KeywordQuestion[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    byStage: { tofu: number; mofu: number; bofu: number };
    byStatus: Record<string, number>;
  } | null>(null);
  const [seedsInput, setSeedsInput] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expanding, setExpanding] = useState(false);
  const [generatingQs, setGeneratingQs] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryMode, setDiscoveryMode] = useState<'sandbox' | 'live' | null>(null);
  const [discoveryConfigured, setDiscoveryConfigured] = useState(false);
  const [siteUrl, setSiteUrl] = useState(
    workspace === 'empleados' ? 'https://empliados.net' : 'https://cleexs.net',
  );
  const [bizDescription, setBizDescription] = useState(
    workspace === 'empleados'
      ? 'Plataforma de marca empleadora y atracción de talento'
      : 'Plataforma para conseguir clientes desde ChatGPT y medir visibilidad en IA',
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOpportunities(workspace, {
        stage: stageFilter || undefined,
        status: statusFilter || undefined,
      });
      setRows(res.opportunities);
      setQuestions(res.questions ?? []);
      setSummary(res.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar oportunidades');
    } finally {
      setLoading(false);
    }
  }, [stageFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchDiscoveryStatus(workspace)
      .then((s) => {
        setDiscoveryConfigured(s.configured);
        setDiscoveryMode(s.mode);
        if (s.settings?.siteUrl) setSiteUrl(s.settings.siteUrl);
        if (s.settings?.description) setBizDescription(s.settings.description);
        if (Array.isArray(s.seeds) && s.seeds.length && !seedsInput.trim()) {
          setSeedsInput(s.seeds.join('\n'));
        }
      })
      .catch(() => {
        setDiscoveryConfigured(false);
      });
  }, [workspace]);

  const openQuestions = useMemo(
    () =>
      [...questions]
        .filter((q) => q.status !== 'discarded')
        .sort((a, b) => b.priority - a.priority || b.businessFit - a.businessFit),
    [questions],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, KeywordOpportunity[]>();
    for (const row of rows) {
      const list = map.get(row.cluster) ?? [];
      list.push(row);
      map.set(row.cluster, list);
    }
    return [...map.entries()]
      .map(([cluster, items]) => [
        cluster,
        [...items].sort(
          (a, b) =>
            (b.opportunityScore ?? b.priority) - (a.opportunityScore ?? a.priority) ||
            (b.demandScore ?? 0) - (a.demandScore ?? 0) ||
            a.keyword.localeCompare(b.keyword),
        ),
      ] as const)
      .sort((a, b) => {
        const topA = a[1][0]?.opportunityScore ?? a[1][0]?.priority ?? 0;
        const topB = b[1][0]?.opportunityScore ?? b[1][0]?.priority ?? 0;
        return topB - topA || a[0].localeCompare(b[0]);
      });
  }, [rows]);

  async function handleDiscovery() {
    const seeds = seedsInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!seeds.length) {
      setError('Pegá al menos una keyword semilla para Discovery.');
      return;
    }
    if (!siteUrl.trim() || !bizDescription.trim()) {
      setError('Completá sitio y descripción del negocio.');
      return;
    }
    setDiscovering(true);
    setError(null);
    setMessage(null);
    try {
      const res = await runDiscoveryExplore(workspace, {
        siteUrl: siteUrl.trim(),
        description: bizDescription.trim(),
        market: 'ar',
        seeds,
        includeSiteKeywords: true,
        maxCandidates: 40,
      });
      await load();
      setMessage(
        `Discovery (${res.mode}): ${res.briefs} briefs · +${res.created} / ~${res.updated} · cost≈$${res.cost.toFixed(4)}. Top: ${
          res.top[0] ? `${res.top[0].primaryQuery} (${res.top[0].opportunityScore})` : '—'
        }`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en Discovery');
    } finally {
      setDiscovering(false);
    }
  }

  async function handleExpand() {
    const seeds = seedsInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!seeds.length) {
      setError('Pegá al menos una keyword semilla.');
      return;
    }
    setExpanding(true);
    setError(null);
    setMessage(null);
    try {
      const res = await ingestOpportunitySeeds(workspace, seeds, true);
      setRows(res.opportunities);
      setQuestions(res.questions ?? []);
      setSummary(res.summary);
      setMessage(
        `Listo: ${res.created} keywords nuevas (${res.skipped} ya existían). Fuente: ${res.source === 'llm' ? 'LLM' : 'reglas'}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar el cloud');
    } finally {
      setExpanding(false);
    }
  }

  async function handleGenerateQuestions() {
    setGeneratingQs(true);
    setError(null);
    setMessage(null);
    try {
      const res = await generateOpportunityQuestions(workspace);
      setQuestions(res.questions ?? []);
      setMessage(
        res.created > 0
          ? `Teo generó ${res.created} preguntas (${res.clusters} clusters, ${res.source}).`
          : 'Sin preguntas nuevas (ya había suficientes o se alcanzó el tope).',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar preguntas');
    } finally {
      setGeneratingQs(false);
    }
  }

  async function setStatus(id: string, status: KeywordOpportunityStatus) {
    try {
      await updateOpportunity(id, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
    }
  }

  async function setQuestionStatus(id: string, status: KeywordQuestionStatus) {
    try {
      await updateKeywordQuestion(id, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la pregunta');
    }
  }

  async function removeRow(id: string) {
    try {
      await deleteOpportunity(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  return (
    <CentroShell workspaceName={workspaceName}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cleexs-blue">
            Input engine
          </p>
          <h2 className="mt-1 text-3xl font-semibold text-white">Oportunidades</h2>
          <p className="mt-2 max-w-2xl text-sm text-hub-muted">
            Discovery encuentra demanda real (DataForSEO); Teo escribe. Score = demanda + tendencia +
            relevancia al negocio.
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

      <div className="mb-4 rounded-xl border border-cleexs-blue/25 bg-cleexs-blue/10 px-4 py-3 text-sm text-blue-100">
        <strong className="font-semibold text-white">Discovery:</strong>{' '}
        {discoveryConfigured
          ? `DataForSEO listo · modo ${discoveryMode ?? 'sandbox'}.`
          : 'Falta configurar DATAFORSEO_LOGIN / PASSWORD en la API (sandbox gratis).'}{' '}
        Teo toma primero las ideas con mayor opportunity score.
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

      <section className="mb-6 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-semibold text-white">Correr Discovery (DataForSEO)</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-hub-muted">
            Sitio
            <input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="mt-1 w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white"
              placeholder="https://empliados.net"
            />
          </label>
          <label className="block text-xs text-hub-muted">
            Descripción del negocio
            <input
              value={bizDescription}
              onChange={(e) => setBizDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white"
              placeholder="Qué hace el producto"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-hub-muted">
          Semillas (una por línea)
          <textarea
            value={seedsInput}
            onChange={(e) => setSeedsInput(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white outline-none ring-violet-500/40 focus:ring-2"
            placeholder={'marca empleadora\natracción de talento\nemployer branding'}
          />
        </label>
        <button
          type="button"
          disabled={discovering || !discoveryConfigured}
          onClick={handleDiscovery}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {discovering ? 'Discovery corriendo…' : 'Explorar mercado'}
        </button>
      </section>

      <section className="mb-6 rounded-2xl border border-hub-border bg-hub-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-cleexs-blue" />
          <h3 className="text-sm font-semibold text-white">Expansión LLM / reglas (legacy)</h3>
        </div>
        <p className="mb-3 text-xs text-hub-muted">
          Cloud sin volumen real. Preferí Discovery arriba cuando DataForSEO esté configurado.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={expanding}
            onClick={handleExpand}
            className="inline-flex items-center gap-2 rounded-xl bg-cleexs-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {expanding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {expanding ? 'Generando cloud…' : 'Forzar expansión LLM'}
          </button>
          <button
            type="button"
            disabled={generatingQs}
            onClick={handleGenerateQuestions}
            className="inline-flex items-center gap-2 rounded-xl border border-hub-border px-4 py-2.5 text-sm text-slate-200 disabled:opacity-60"
          >
            {generatingQs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {generatingQs ? 'Generando preguntas…' : 'Forzar preguntas ahora'}
          </button>
        </div>
      </section>

      {summary ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-5">
          <Stat label="Total KW" value={summary.total} />
          <Stat label="TOFU" value={summary.byStage.tofu} />
          <Stat label="MOFU" value={summary.byStage.mofu} />
          <Stat label="BOFU" value={summary.byStage.bofu} />
          <Stat label="Preguntas" value={openQuestions.length} />
        </div>
      ) : null}

      {!loading && openQuestions.length > 0 ? (
        <section className="mb-6 overflow-hidden rounded-2xl border border-hub-border bg-hub-card">
          <div className="border-b border-hub-border px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Preguntas reales (FAQ map)</h3>
            <p className="text-xs text-hub-muted">
              Teo las genera solo por cluster. Alimentan piezas FAQ cuando falta cobertura.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#0b1220]/60 text-xs uppercase tracking-wide text-hub-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Pregunta</th>
                  <th className="px-4 py-3 font-medium">Cluster</th>
                  <th className="px-4 py-3 font-medium">Etapa</th>
                  <th className="px-4 py-3 font-medium">Negocio</th>
                  <th className="px-4 py-3 font-medium">Prioridad</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {openQuestions.slice(0, 60).map((q) => {
                  const stage = STAGE_META[q.stage];
                  return (
                    <tr key={q.id} className="border-t border-hub-border/70">
                      <td className="px-4 py-3 text-slate-100">
                        <div className="font-medium">{q.question}</div>
                        <div className="text-xs text-hub-muted">
                          {q.intentLabel ?? q.intent ?? '—'} · {q.source}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{q.cluster}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                            stage.className,
                          )}
                        >
                          {stage.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-200">{q.businessFit}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-100">{q.priority}</td>
                      <td className="px-4 py-3 text-slate-300">{QUESTION_STATUS[q.status]}</td>
                      <td className="px-4 py-3">
                        {q.status !== 'discarded' ? (
                          <button
                            type="button"
                            onClick={() => setQuestionStatus(q.id, 'discarded')}
                            className="rounded-lg border border-hub-border px-2.5 py-1 text-xs text-slate-400"
                          >
                            Descartar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-xl border border-hub-border bg-hub-card px-3 py-2 text-sm text-white"
        >
          <option value="">Todas las etapas</option>
          <option value="tofu">TOFU</option>
          <option value="mofu">MOFU</option>
          <option value="bofu">BOFU</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-hub-border bg-hub-card px-3 py-2 text-sm text-white"
        >
          <option value="">Todos los estados</option>
          <option value="idea">Idea</option>
          <option value="queued">En cola</option>
          <option value="in_progress">En curso</option>
          <option value="covered">Cubierta</option>
          <option value="discarded">Descartada</option>
        </select>
      </div>

      {loading ? (
        <p className="text-hub-muted">Cargando oportunidades…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hub-border px-6 py-12 text-center text-sm text-hub-muted">
          Todavía no hay oportunidades. Cargá semillas y generá el cloud.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cluster, items]) => (
            <section key={cluster} className="overflow-hidden rounded-2xl border border-hub-border bg-hub-card">
              <div className="border-b border-hub-border px-4 py-3">
                <h3 className="text-sm font-semibold text-white">{cluster}</h3>
                <p className="text-xs text-hub-muted">{items.length} keywords</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#0b1220]/60 text-xs uppercase tracking-wide text-hub-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Keyword</th>
                      <th className="px-4 py-3 font-medium">Etapa</th>
                      <th className="px-4 py-3 font-medium">Vol</th>
                      <th className="px-4 py-3 font-medium">Opp</th>
                      <th className="px-4 py-3 font-medium">GSC</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      const stage = STAGE_META[row.stage];
                      return (
                        <tr key={row.id} className="border-t border-hub-border/70">
                          <td className="px-4 py-3 text-slate-100">
                            <div className="font-medium">{row.keyword}</div>
                            <div className="text-xs text-hub-muted">semilla: {row.seedKeyword}</div>
                            {row.scoreReason ? (
                              <div
                                className="mt-1 max-w-xs text-[11px] leading-snug text-hub-muted/90"
                                title={row.scoreReason}
                              >
                                {row.scoreReason}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                                stage.className,
                              )}
                              title={stage.hint}
                            >
                              {stage.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-200">
                            {row.monthlySearches != null ? row.monthlySearches : '—'}
                          </td>
                          <td className="px-4 py-3 font-medium tabular-nums text-slate-100">
                            {row.opportunityScore ?? row.priority}
                          </td>
                          <td className="px-4 py-3 text-xs tabular-nums text-slate-400">
                            {row.gscImpressions != null || row.gscClicks != null
                              ? `${row.gscImpressions ?? 0} imp · ${row.gscClicks ?? 0} clic`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{STATUS_LABEL[row.status]}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {row.status !== 'queued' ? (
                                <button
                                  type="button"
                                  onClick={() => setStatus(row.id, 'queued')}
                                  className="rounded-lg bg-cleexs-blue/20 px-2.5 py-1 text-xs font-medium text-blue-100 hover:bg-cleexs-blue/30"
                                >
                                  Encolar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setStatus(row.id, 'idea')}
                                  className="rounded-lg border border-hub-border px-2.5 py-1 text-xs text-slate-300"
                                >
                                  Quitar cola
                                </button>
                              )}
                              {row.status !== 'discarded' ? (
                                <button
                                  type="button"
                                  onClick={() => setStatus(row.id, 'discarded')}
                                  className="rounded-lg border border-hub-border px-2.5 py-1 text-xs text-slate-400"
                                >
                                  Descartar
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => removeRow(row.id)}
                                className="rounded-lg p-1 text-slate-500 hover:text-red-300"
                                aria-label="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </CentroShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-hub-border bg-hub-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-hub-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
