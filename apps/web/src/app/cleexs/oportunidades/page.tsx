'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Target, Trash2 } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import {
  deleteOpportunity,
  fetchOpportunities,
  ingestOpportunitySeeds,
  updateOpportunity,
  type FunnelStage,
  type KeywordOpportunity,
  type KeywordOpportunityStatus,
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

export default function OportunidadesPage() {
  const [rows, setRows] = useState<KeywordOpportunity[]>([]);
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOpportunities('cleexs', {
        stage: stageFilter || undefined,
        status: statusFilter || undefined,
      });
      setRows(res.opportunities);
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

  const grouped = useMemo(() => {
    const map = new Map<string, KeywordOpportunity[]>();
    for (const row of rows) {
      const list = map.get(row.cluster) ?? [];
      list.push(row);
      map.set(row.cluster, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

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
      const res = await ingestOpportunitySeeds('cleexs', seeds, true);
      setRows(res.opportunities);
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

  async function setStatus(id: string, status: KeywordOpportunityStatus) {
    try {
      await updateOpportunity(id, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
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
    <CentroShell workspaceName="Cleexs">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cleexs-blue">
            Input engine
          </p>
          <h2 className="mt-1 text-3xl font-semibold text-white">Oportunidades</h2>
          <p className="mt-2 max-w-2xl text-sm text-hub-muted">
            Teo genera y prioriza solo a partir de tus temas semilla. Esta pantalla es el radar:
            mirás qué eligió, descartás lo que no sirve. No hace falta encolar nada para que escriba.
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
        <strong className="font-semibold text-white">Autónomo:</strong> el scheduler toma tus temas
        de Config → Temas y reglas, arma el cloud TOFU/MOFU/BOFU y escribe primero las de mayor
        prioridad. <em>Encolar</em> solo fuerza una keyword; <em>Descartar</em> la saca del radar.
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

      <section className="mb-6 rounded-2xl border border-hub-border bg-hub-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-cleexs-blue" />
          <h3 className="text-sm font-semibold text-white">Semillas extras (opcional)</h3>
        </div>
        <p className="mb-3 text-xs text-hub-muted">
          Lo normal es definir temas en <span className="text-slate-300">Config → Temas y reglas</span>
          ; Teo expande solo. Acá podés forzar semillas adicionales si querés.
        </p>
        <textarea
          value={seedsInput}
          onChange={(e) => setSeedsInput(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white outline-none ring-cleexs-blue/40 focus:ring-2"
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={expanding}
            onClick={handleExpand}
            className="inline-flex items-center gap-2 rounded-xl bg-cleexs-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {expanding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {expanding ? 'Generando cloud…' : 'Forzar expansión ahora'}
          </button>
        </div>
      </section>

      {summary ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          <Stat label="Total" value={summary.total} />
          <Stat label="TOFU" value={summary.byStage.tofu} />
          <Stat label="MOFU" value={summary.byStage.mofu} />
          <Stat label="BOFU" value={summary.byStage.bofu} />
        </div>
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
                      <th className="px-4 py-3 font-medium">Intención</th>
                      <th className="px-4 py-3 font-medium">Prioridad</th>
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
                          <td className="px-4 py-3 text-slate-300">
                            {row.intentLabel ?? row.intent ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{row.priority}</td>
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
