'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import {
  approveGrowthOpportunity,
  cancelGrowthConversationRun,
  collectGrowthInterventionMetrics,
  discardGrowthOpportunity,
  fetchGrowthConversationRun,
  fetchGrowthConversationRuns,
  fetchGrowthConversationsStatus,
  fetchGrowthTopicInsights,
  fetchPieces,
  registerGrowthManualMetric,
  registerGrowthPublished,
  startGrowthConversationFromPiece,
  updateGrowthReplyDraft,
  type GrowthConversationRunDetail,
  type GrowthConversationRunRow,
  type GrowthConversationsStatus,
  type GrowthOpportunityRow,
  type GrowthTopicInsightRow,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

const IN_PROGRESS = new Set([
  'queued',
  'generating_queries',
  'searching',
  'verifying',
  'scoring',
  'drafting',
]);

function RunStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: 'border-hub-border bg-hub-card text-hub-muted',
    generating_queries: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
    searching: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
    verifying: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
    scoring: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
    drafting: 'border-orange-500/40 bg-orange-500/10 text-orange-100',
    completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
    completed_partial: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
    failed: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
    cancelled: 'border-hub-border bg-[#0b1220] text-hub-muted',
  };
  return (
    <span
      className={cn(
        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        styles[status] || styles.queued,
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function EditorialBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    candidate: 'border-hub-border text-hub-muted',
    draft_ready: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
    approved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
    discarded: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
  };
  const labels: Record<string, string> = {
    candidate: 'candidato',
    draft_ready: 'borrador listo',
    approved: 'aprobado',
    discarded: 'descartado',
  };
  return (
    <span
      className={cn(
        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        styles[status] || styles.candidate,
      )}
    >
      {labels[status] || status}
    </span>
  );
}

function formatScore(n: number) {
  return `${Math.round(n * 100)}%`;
}

function formatCost(run: GrowthConversationRunRow) {
  const value = run.costUsd ?? run.costEstimatedUsd;
  if (value == null) return null;
  const label = `$${value.toFixed(4)} USD`;
  return run.costIsEstimate !== false || run.costUsd == null ? `${label} (est.)` : label;
}

function unknownLabel(v: boolean | null | undefined, knownTrue: string, knownFalse: string) {
  if (v === true) return knownTrue;
  if (v === false) return knownFalse;
  return 'desconocido';
}

type Props = {
  workspace: string;
};

export function ConversationsPanel({ workspace }: Props) {
  const [status, setStatus] = useState<GrowthConversationsStatus | null>(null);
  const [runs, setRuns] = useState<GrowthConversationRunRow[]>([]);
  const [pieces, setPieces] = useState<Array<{ id: string; title: string }>>([]);
  const [pieceId, setPieceId] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<GrowthConversationRunDetail | null>(null);
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [insights, setInsights] = useState<GrowthTopicInsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [draftBody, setDraftBody] = useState('');
  const [discardReason, setDiscardReason] = useState('');
  const [publishUrl, setPublishUrl] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [publishNotes, setPublishNotes] = useState('');
  const [metricKind, setMetricKind] = useState<
    'contact_manual' | 'commercial_manual' | 'interaction_manual'
  >('contact_manual');
  const [metricValue, setMetricValue] = useState('1');
  const [metricNotes, setMetricNotes] = useState('');

  const selectedOpp: GrowthOpportunityRow | null = useMemo(() => {
    if (!runDetail?.opportunities?.length) return null;
    return (
      runDetail.opportunities.find((o) => o.id === selectedOppId) ??
      runDetail.opportunities[0] ??
      null
    );
  }, [runDetail, selectedOppId]);

  const latestDraft = selectedOpp?.drafts?.[0] ?? null;

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, runsRes, piecesRes, insightsRes] = await Promise.all([
        fetchGrowthConversationsStatus(workspace),
        fetchGrowthConversationRuns(workspace),
        fetchPieces(workspace).catch(() => ({
          pieces: [] as Array<{ id: string; title: string; status?: string }>,
        })),
        fetchGrowthTopicInsights(workspace).catch(() => ({ insights: [] as GrowthTopicInsightRow[] })),
      ]);
      setStatus(statusRes);
      setRuns(runsRes.runs);
      setPieces(
        (piecesRes.pieces || [])
          .filter((p) => !p.status || p.status === 'published')
          .map((p: { id: string; title: string }) => ({ id: p.id, title: p.title })),
      );
      setInsights(insightsRes.insights || []);
      setSelectedRunId((prev) => {
        if (prev && runsRes.runs.some((r) => r.id === prev)) return prev;
        return runsRes.runs[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar Conversaciones');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  const loadRun = useCallback(
    async (runId: string) => {
      setDetailLoading(true);
      try {
        const res = await fetchGrowthConversationRun(workspace, runId);
        setRunDetail(res.run);
        setSelectedOppId((prev) => {
          if (prev && res.run.opportunities.some((o) => o.id === prev)) return prev;
          return res.run.opportunities[0]?.id ?? null;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar ejecución');
        setRunDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [workspace],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null);
      return;
    }
    loadRun(selectedRunId);
  }, [selectedRunId, loadRun]);

  useEffect(() => {
    setDraftBody(latestDraft?.body ?? '');
    setDiscardReason('');
    setPublishUrl('');
    setPublishAt('');
    setPublishNotes('');
  }, [latestDraft?.id, latestDraft?.body, selectedOpp?.id]);

  async function refreshAll() {
    await loadList();
    if (selectedRunId) await loadRun(selectedRunId);
  }

  async function handleSearch() {
    if (!pieceId) {
      setError('Elegí un artículo publicado.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await startGrowthConversationFromPiece(workspace, pieceId);
      setMessage('Búsqueda iniciada. Aprobado ≠ publicado: revisá borradores cuando termine.');
      await loadList();
      setSelectedRunId(res.run.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar conversaciones');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(runId: string) {
    setBusy(true);
    setError(null);
    try {
      await cancelGrowthConversationRun(workspace, runId);
      setMessage('Ejecución cancelada.');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft() {
    if (!latestDraft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await updateGrowthReplyDraft(workspace, latestDraft.id, { body: draftBody });
      setMessage(res.note || 'Borrador actualizado.');
      if (selectedRunId) await loadRun(selectedRunId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar borrador');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!draftBody.trim()) return;
    try {
      await navigator.clipboard.writeText(draftBody);
      setMessage('Borrador copiado al portapapeles. Pegalo manualmente en el hilo — no está publicado.');
    } catch {
      setError('No se pudo copiar al portapapeles.');
    }
  }

  async function handleApprove() {
    if (!selectedOpp || !latestDraft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await approveGrowthOpportunity(workspace, selectedOpp.id, {
        draftId: latestDraft.id,
        body: draftBody,
      });
      setMessage(
        res.note ||
          'Borrador aprobado para revisión/copia. Todavía NO está publicado. Registrá la publicación cuando lo hayas pegado en el hilo.',
      );
      if (selectedRunId) await loadRun(selectedRunId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aprobar');
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscard() {
    if (!selectedOpp) return;
    if (!discardReason.trim()) {
      setError('Indicá un motivo de descarte.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await discardGrowthOpportunity(workspace, selectedOpp.id, discardReason.trim());
      setMessage('Oportunidad descartada.');
      if (selectedRunId) await loadRun(selectedRunId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descartar');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterPublished() {
    if (!selectedOpp) return;
    if (selectedOpp.editorialStatus !== 'approved') {
      setError('Aprobá el borrador antes de registrar la publicación manual.');
      return;
    }
    if (!publishUrl.trim()) {
      setError('Indicá la URL donde pegaste la respuesta.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: { publishedUrl: string; publishedAt?: string; notes?: string; draftId?: string } =
        {
          publishedUrl: publishUrl.trim(),
          notes: publishNotes.trim() || undefined,
          draftId: latestDraft?.id,
        };
      if (publishAt) {
        payload.publishedAt = new Date(publishAt).toISOString();
      }
      const res = await registerGrowthPublished(workspace, selectedOpp.id, payload);
      setMessage(res.note || 'Publicación manual registrada.');
      setPublishUrl('');
      setPublishAt('');
      setPublishNotes('');
      if (selectedRunId) await loadRun(selectedRunId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar publicación');
    } finally {
      setBusy(false);
    }
  }

  async function handleCollectGa4(interventionId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await collectGrowthInterventionMetrics(workspace, interventionId);
      setMessage(
        res.collected
          ? 'Métricas GA4 recolectadas (si hay sesiones atribuibles).'
          : res.reason || 'GA4 no disponible.',
      );
      if (selectedRunId) await loadRun(selectedRunId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al recolectar GA4');
    } finally {
      setBusy(false);
    }
  }

  async function handleManualMetric(interventionId: string) {
    const value = Number(metricValue);
    if (!Number.isFinite(value) || value < 0) {
      setError('Valor de métrica inválido.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await registerGrowthManualMetric(workspace, interventionId, {
        kind: metricKind,
        value,
        notes: metricNotes.trim() || undefined,
      });
      setMessage(res.note || 'Métrica manual registrada.');
      setMetricNotes('');
      if (selectedRunId) await loadRun(selectedRunId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar métrica');
    } finally {
      setBusy(false);
    }
  }

  const dfsMode = status?.integrations.dataforseo.mode;
  const dfsBanner =
    dfsMode === 'sandbox'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
      : dfsMode === 'live'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
        : 'border-rose-500/40 bg-rose-500/10 text-rose-100';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-orange-300" />
          <h3 className="text-lg font-semibold text-white">Comunicacional</h3>
          <span className="rounded-md border border-hub-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-hub-muted">
            conversaciones
          </span>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center gap-2 rounded-xl border border-hub-border bg-hub-card px-3 py-2 text-sm text-slate-200"
        >
          <RefreshCw className="h-4 w-4" /> Recargar
        </button>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-hub-muted">
        Buscá hilos relevantes a artículos publicados, redactá respuestas útiles y registrá la
        publicación manual. No hay auto-post ni publicación en LinkedIn desde este módulo.
      </p>

      {status ? (
        <div className={cn('mb-6 space-y-3 rounded-2xl border p-4', dfsBanner)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                Estado integraciones
              </p>
              <p className="mt-1 text-sm font-medium">
                DataForSEO:{' '}
                {dfsMode === 'sandbox'
                  ? 'sandbox'
                  : dfsMode === 'live'
                    ? 'live'
                    : 'no configurado'}
              </p>
              <p className="mt-1 text-xs opacity-90">{status.integrations.dataforseo.note}</p>
            </div>
            <div className="text-right text-xs">
              <p>
                GA4:{' '}
                <span className="font-semibold">
                  {status.integrations.ga4.configured ? 'configurado' : 'no configurado'}
                </span>
              </p>
              <p className="mt-1 max-w-xs opacity-90">{status.integrations.ga4.note}</p>
              <p className="mt-2">
                Auto-trigger al publicar:{' '}
                <span className="font-semibold">
                  {status.config.autoTriggerOnPublish ? 'activado' : 'apagado'}
                </span>
              </p>
            </div>
          </div>
          {status.limitations.length > 0 ? (
            <ul className="list-inside list-disc text-xs opacity-90">
              {status.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

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

      <section className="mb-6 rounded-2xl border border-hub-border bg-hub-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">Buscar desde artículo publicado</h3>
        <div className="flex flex-wrap gap-3">
          <select
            value={pieceId}
            onChange={(e) => setPieceId(e.target.value)}
            className="min-w-[280px] flex-1 rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white"
          >
            <option value="">Elegí una pieza…</option>
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !pieceId}
            onClick={handleSearch}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar conversaciones
          </button>
        </div>
      </section>

      {loading ? (
        <p className="text-sm text-hub-muted">Cargando conversaciones…</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <section className="overflow-hidden rounded-2xl border border-hub-border bg-hub-card">
            <div className="border-b border-hub-border px-4 py-3">
              <h3 className="text-sm font-semibold text-white">Ejecuciones</h3>
              <p className="text-xs text-hub-muted">Runs · costo estimado si aplica</p>
            </div>
            {runs.length === 0 ? (
              <p className="px-4 py-8 text-sm text-hub-muted">
                Todavía no hay búsquedas. Elegí un artículo publicado arriba.
              </p>
            ) : (
              <ul className="max-h-[720px] divide-y divide-hub-border/70 overflow-y-auto">
                {runs.map((row) => {
                  const active = row.id === selectedRunId;
                  const cost = formatCost(row);
                  return (
                    <li key={row.id}>
                      <div
                        className={cn(
                          'px-4 py-3 transition',
                          active ? 'bg-orange-500/15' : 'hover:bg-[#0b1220]/50',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedRunId(row.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-white">{row.piece.title}</p>
                            <RunStatusBadge status={row.status} />
                          </div>
                          <p className="mt-1 text-xs text-hub-muted">
                            {row.progressMessage ||
                              `${row.queryCount} queries · ${row.opportunityCount} oportunidades`}
                            {cost ? ` · ${cost}` : ''}
                          </p>
                          <p className="mt-0.5 text-[11px] text-hub-muted">
                            {new Date(row.createdAt).toLocaleString('es-AR')}
                            {row.providerMode ? ` · DFS ${row.providerMode}` : ''}
                          </p>
                          {row.errorMessage ? (
                            <p className="mt-1 text-xs text-rose-300">{row.errorMessage}</p>
                          ) : null}
                        </button>
                        {IN_PROGRESS.has(row.status) ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleCancel(row.id)}
                            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-hub-border px-2 py-1 text-[11px] text-slate-300 disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" /> Cancelar
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            {!selectedRunId ? (
              <p className="rounded-2xl border border-hub-border bg-hub-card px-4 py-10 text-center text-sm text-hub-muted">
                Seleccioná una ejecución.
              </p>
            ) : detailLoading && !runDetail ? (
              <p className="text-sm text-hub-muted">Cargando detalle…</p>
            ) : !runDetail ? (
              <p className="rounded-2xl border border-hub-border bg-hub-card px-4 py-10 text-center text-sm text-hub-muted">
                No se pudo cargar el detalle.
              </p>
            ) : (
              <>
                <div className="rounded-2xl border border-hub-border bg-hub-card p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-hub-muted">Detalle run</p>
                      <h3 className="text-lg font-semibold text-white">{runDetail.piece.title}</h3>
                    </div>
                    <RunStatusBadge status={runDetail.status} />
                  </div>
                  <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                    <p>
                      Queries: <span className="text-white">{runDetail.queries?.length ?? runDetail.queryCount}</span>
                    </p>
                    <p>
                      SERP hits: <span className="text-white">{runDetail.serpHitCount}</span>
                    </p>
                    <p>
                      Verificadas: <span className="text-white">{runDetail.verifiedCount}</span>
                    </p>
                  </div>
                  {runDetail.queries?.length ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-hub-muted">
                        Ver queries ({runDetail.queries.length})
                      </summary>
                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-300">
                        {runDetail.queries.map((q) => (
                          <li key={q.id} className="rounded-lg bg-[#0b1220] px-2 py-1">
                            {q.query}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="overflow-hidden rounded-2xl border border-hub-border bg-hub-card">
                    <div className="border-b border-hub-border px-4 py-3">
                      <h4 className="text-sm font-semibold text-white">Oportunidades</h4>
                    </div>
                    {runDetail.opportunities.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-hub-muted">Sin oportunidades en este run.</p>
                    ) : (
                      <ul className="max-h-[480px] divide-y divide-hub-border/70 overflow-y-auto">
                        {runDetail.opportunities.map((opp) => {
                          const active = opp.id === selectedOpp?.id;
                          return (
                            <li key={opp.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedOppId(opp.id)}
                                className={cn(
                                  'w-full px-4 py-3 text-left transition',
                                  active ? 'bg-orange-500/15' : 'hover:bg-[#0b1220]/50',
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium text-white">
                                    {opp.conversation.title || opp.conversation.domain}
                                  </p>
                                  <EditorialBadge status={opp.editorialStatus} />
                                </div>
                                <p className="mt-1 text-xs text-hub-muted">
                                  score {formatScore(opp.opportunityScore)} · evidencia{' '}
                                  {formatScore(opp.evidenceConfidence)}
                                  {opp.recommendedRank != null
                                    ? ` · rank #${opp.recommendedRank}`
                                    : ''}
                                </p>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {selectedOpp ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-hub-border bg-hub-card p-5">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-hub-muted">
                              Conversación
                            </p>
                            <h4 className="text-base font-semibold text-white">
                              {selectedOpp.conversation.title || selectedOpp.conversation.domain}
                            </h4>
                          </div>
                          <a
                            href={selectedOpp.conversation.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-hub-border px-2 py-1 text-xs text-orange-100 hover:bg-orange-500/10"
                          >
                            <ExternalLink className="h-3 w-3" /> Abrir original
                          </a>
                        </div>

                        <div className="mb-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                          <p>
                            Score:{' '}
                            <span className="text-white">
                              {formatScore(selectedOpp.opportunityScore)}
                            </span>
                          </p>
                          <p>
                            Confianza evidencia:{' '}
                            <span className="text-white">
                              {formatScore(selectedOpp.evidenceConfidence)}
                            </span>
                          </p>
                          <p>
                            Verificación:{' '}
                            <span className="text-white">
                              {selectedOpp.conversation.verifyStatus === 'verified'
                                ? 'verificado'
                                : selectedOpp.conversation.verifyStatus}
                            </span>
                          </p>
                          <p>
                            Permite respuestas:{' '}
                            <span className="text-white">
                              {unknownLabel(
                                selectedOpp.conversation.allowsReplies,
                                'sí',
                                'no',
                              )}
                              {selectedOpp.conversation.allowsReplies == null
                                ? ' (allowsReplies null)'
                                : ''}
                            </span>
                          </p>
                          <p>
                            Creado:{' '}
                            <span className="text-white">
                              {selectedOpp.conversation.threadCreatedAtKnown &&
                              selectedOpp.conversation.threadCreatedAt
                                ? new Date(
                                    selectedOpp.conversation.threadCreatedAt,
                                  ).toLocaleDateString('es-AR')
                                : 'fecha desconocida'}
                            </span>
                          </p>
                          <p>
                            Última actividad:{' '}
                            <span className="text-white">
                              {selectedOpp.conversation.lastActivityAtKnown &&
                              selectedOpp.conversation.lastActivityAt
                                ? new Date(
                                    selectedOpp.conversation.lastActivityAt,
                                  ).toLocaleDateString('es-AR')
                                : 'fecha desconocida'}
                            </span>
                          </p>
                        </div>

                        {(selectedOpp.scoreBreakdown?.motives?.length ?? 0) > 0 ? (
                          <div className="mb-3">
                            <p className="mb-1 text-[11px] uppercase tracking-wide text-hub-muted">
                              Motivos (scoreBreakdown)
                            </p>
                            <ul className="list-inside list-disc text-xs text-slate-300">
                              {selectedOpp.scoreBreakdown.motives!.map((m) => (
                                <li key={m}>{m}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {selectedOpp.conversation.evidenceSnippet ? (
                          <p className="rounded-xl bg-[#0b1220] px-3 py-2 text-xs text-slate-300">
                            {selectedOpp.conversation.evidenceSnippet}
                          </p>
                        ) : null}
                      </div>

                      {latestDraft ? (
                        <div className="rounded-2xl border border-hub-border bg-hub-card p-5">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-white">
                              Borrador de respuesta
                            </h4>
                            <EditorialBadge status={selectedOpp.editorialStatus} />
                          </div>
                          <p className="mb-3 text-xs text-amber-200/90">
                            Aprobar deja el borrador listo para copiar/pegar. No publica en el foro
                            ni en LinkedIn.
                          </p>
                          <textarea
                            value={draftBody}
                            onChange={(e) => setDraftBody(e.target.value)}
                            rows={8}
                            className="w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white"
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={handleSaveDraft}
                              className="rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              disabled={busy || !draftBody.trim()}
                              onClick={handleCopy}
                              className="inline-flex items-center gap-1 rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                            >
                              <Copy className="h-3.5 w-3.5" /> Copiar
                            </button>
                            <button
                              type="button"
                              disabled={
                                busy ||
                                selectedOpp.editorialStatus === 'discarded' ||
                                selectedOpp.editorialStatus === 'approved'
                              }
                              onClick={handleApprove}
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                            </button>
                          </div>

                          <div className="mt-4 border-t border-hub-border pt-4">
                            <p className="mb-2 text-xs text-hub-muted">Descartar con motivo</p>
                            <div className="flex flex-wrap gap-2">
                              <input
                                value={discardReason}
                                onChange={(e) => setDiscardReason(e.target.value)}
                                placeholder="Motivo…"
                                className="min-w-[200px] flex-1 rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white"
                              />
                              <button
                                type="button"
                                disabled={busy || selectedOpp.editorialStatus === 'discarded'}
                                onClick={handleDiscard}
                                className="rounded-xl border border-rose-500/40 px-3 py-2 text-sm text-rose-200 disabled:opacity-50"
                              >
                                Descartar
                              </button>
                            </div>
                          </div>

                          {selectedOpp.editorialStatus === 'approved' ? (
                            <div className="mt-4 border-t border-hub-border pt-4">
                              <p className="mb-2 text-sm font-semibold text-white">
                                Registrar publicación manual
                              </p>
                              <p className="mb-3 text-xs text-hub-muted">
                                Solo después de aprobar y de haber pegado la respuesta en el hilo.
                              </p>
                              <div className="grid gap-2">
                                <input
                                  value={publishUrl}
                                  onChange={(e) => setPublishUrl(e.target.value)}
                                  placeholder="URL de la respuesta publicada"
                                  className="rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white"
                                />
                                <input
                                  type="datetime-local"
                                  value={publishAt}
                                  onChange={(e) => setPublishAt(e.target.value)}
                                  className="rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white"
                                />
                                <input
                                  value={publishNotes}
                                  onChange={(e) => setPublishNotes(e.target.value)}
                                  placeholder="Notas (opcional)"
                                  className="rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white"
                                />
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={handleRegisterPublished}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                  Registrar publicación
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="rounded-2xl border border-hub-border bg-hub-card px-4 py-6 text-sm text-hub-muted">
                          Sin borrador todavía para esta oportunidad.
                        </p>
                      )}

                      {selectedOpp.interventions?.length ? (
                        <div className="rounded-2xl border border-hub-border bg-hub-card p-5">
                          <h4 className="mb-3 text-sm font-semibold text-white">
                            Intervenciones y métricas
                          </h4>
                          <div className="space-y-4">
                            {selectedOpp.interventions.map((iv) => (
                              <div
                                key={iv.id}
                                className="rounded-xl border border-hub-border/70 bg-[#0b1220] p-3"
                              >
                                <p className="text-xs text-hub-muted">
                                  {new Date(iv.publishedAt).toLocaleString('es-AR')}
                                </p>
                                <a
                                  href={iv.publishedUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-sm text-orange-100"
                                >
                                  {iv.publishedUrl} <ExternalLink className="h-3 w-3" />
                                </a>
                                {iv.articleUrlWithUtm ? (
                                  <p className="mt-1 break-all text-[11px] text-hub-muted">
                                    UTM: {iv.articleUrlWithUtm}
                                  </p>
                                ) : null}
                                {iv.metrics?.length ? (
                                  <ul className="mt-2 space-y-1 text-xs text-slate-300">
                                    {iv.metrics.map((m) => (
                                      <li key={m.id}>
                                        {m.kind} ·{' '}
                                        {m.valueKnown && m.value != null
                                          ? m.value
                                          : 'desconocido'}{' '}
                                        · {m.source}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-2 text-xs text-hub-muted">Sin métricas aún.</p>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleCollectGa4(iv.id)}
                                    className="rounded-lg border border-hub-border px-2 py-1 text-[11px] text-slate-200 disabled:opacity-50"
                                  >
                                    Recolectar GA4
                                  </button>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                  <select
                                    value={metricKind}
                                    onChange={(e) =>
                                      setMetricKind(
                                        e.target.value as
                                          | 'contact_manual'
                                          | 'commercial_manual'
                                          | 'interaction_manual',
                                      )
                                    }
                                    className="rounded-lg border border-hub-border bg-hub-card px-2 py-1 text-xs text-white"
                                  >
                                    <option value="contact_manual">contacto</option>
                                    <option value="commercial_manual">comercial</option>
                                    <option value="interaction_manual">interacción</option>
                                  </select>
                                  <input
                                    value={metricValue}
                                    onChange={(e) => setMetricValue(e.target.value)}
                                    className="rounded-lg border border-hub-border bg-hub-card px-2 py-1 text-xs text-white"
                                    placeholder="Valor"
                                  />
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleManualMetric(iv.id)}
                                    className="rounded-lg bg-orange-600/90 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                                  >
                                    Registrar métrica
                                  </button>
                                </div>
                                <input
                                  value={metricNotes}
                                  onChange={(e) => setMetricNotes(e.target.value)}
                                  placeholder="Notas métrica (opcional)"
                                  className="mt-2 w-full rounded-lg border border-hub-border bg-hub-card px-2 py-1 text-xs text-white"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {insights.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-hub-border bg-hub-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-white">Insights para Discovery</h3>
          <p className="mb-4 text-xs text-hub-muted">
            Recomendaciones revisables. No cambian prioridades automáticamente.
          </p>
          <ul className="space-y-2">
            {insights.slice(0, 8).map((ins) => (
              <li
                key={ins.id}
                className="rounded-xl border border-hub-border/60 bg-[#0b1220] px-3 py-2 text-sm text-slate-300"
              >
                <span className="font-medium text-white">{ins.topicKey}</span>
                {ins.piece?.title ? (
                  <span className="text-hub-muted"> · {ins.piece.title}</span>
                ) : null}
                <span className="ml-2 text-[10px] uppercase text-hub-muted">{ins.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
