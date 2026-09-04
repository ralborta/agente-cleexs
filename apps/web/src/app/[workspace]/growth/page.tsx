'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import { getStoredUser } from '@/lib/auth-client';
import {
  approveCreativeRequest,
  createCreativeFromPiece,
  fetchCreativeAssetObjectUrl,
  fetchCreativeRequests,
  fetchPieces,
  reprocessCreativeRequest,
  type CreativeRequestRow,
} from '@/lib/api-client';
import { useWorkspaceSlug } from '@/lib/workspace';
import { cn } from '@/lib/utils';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    preview: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
    approved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
    failed: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
    blocked: 'border-orange-500/40 bg-orange-500/10 text-orange-100',
    queued: 'border-hub-border bg-hub-card text-hub-muted',
    planning: 'border-violet-500/40 bg-violet-500/10 text-violet-100',
    rendering: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
  };
  return (
    <span
      className={cn(
        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        styles[status] || styles.queued,
      )}
    >
      {status}
    </span>
  );
}

export default function GrowthPage() {
  const workspace = useWorkspaceSlug();
  const workspaceName =
    getStoredUser()?.workspaceName || getStoredUser()?.workspaceSlug || 'Workspace';

  const [requests, setRequests] = useState<CreativeRequestRow[]>([]);
  const [pieces, setPieces] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pieceId, setPieceId] = useState('');

  const selected = requests.find((r) => r.id === selectedId) ?? requests[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, piecesRes] = await Promise.all([
        fetchCreativeRequests(workspace),
        fetchPieces(workspace).catch(() => ({ pieces: [] as Array<{ id: string; title: string; status?: string }> })),
      ]);
      setRequests(reqRes.requests);
      setPieces(
        (piecesRes.pieces || [])
          .filter((p) => !p.status || p.status === 'published')
          .map((p: { id: string; title: string }) => ({
            id: p.id,
            title: p.title,
          })),
      );
      setSelectedId((prev) => {
        if (prev && reqRes.requests.some((r) => r.id === prev)) return prev;
        return reqRes.requests[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar Growth');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let revoked: string | null = null;
    const assetId = selected?.assets[0]?.id;
    if (!assetId) {
      setAssetUrl(null);
      return;
    }
    fetchCreativeAssetObjectUrl(workspace, assetId)
      .then((url) => {
        revoked = url;
        setAssetUrl(url);
      })
      .catch(() => setAssetUrl(null));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [selected?.assets, workspace]);

  async function handleGenerate() {
    if (!pieceId) {
      setError('Elegí un artículo publicado.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await createCreativeFromPiece(workspace, pieceId);
      setMessage(`Creative ${res.result.status}${res.result.templateKey ? ` · ${res.result.templateKey}` : ''}`);
      await load();
      setSelectedId(res.requestId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar');
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await approveCreativeRequest(workspace, selected.id);
      setMessage(res.note || 'Aprobado');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aprobar');
    } finally {
      setBusy(false);
    }
  }

  async function handleReprocess() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await reprocessCreativeRequest(workspace, selected.id);
      setMessage(`Reprocesado · ${res.result.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reprocesar');
    } finally {
      setBusy(false);
    }
  }

  const plan = selected?.plannerOutput;

  return (
    <CentroShell workspaceName={workspaceName}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-100">
            <Sparkles className="h-3.5 w-3.5" />
            Growth · Creative Engine
          </div>
          <h2 className="text-3xl font-semibold text-white">Creative Engine</h2>
          <p className="mt-2 max-w-2xl text-sm text-hub-muted">
            Convierte artículos de Teo en piezas visuales LinkedIn con templates de marca. Preview
            manual · Publisher LinkedIn en una fase posterior.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-hub-border bg-hub-card px-3 py-2 text-sm text-slate-200"
        >
          <RefreshCw className="h-4 w-4" /> Recargar
        </button>
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
        <h3 className="mb-3 text-sm font-semibold text-white">Generar desde artículo publicado</h3>
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
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            Generar creative
          </button>
        </div>
      </section>

      {loading ? (
        <p className="text-sm text-hub-muted">Cargando cola Creative…</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="overflow-hidden rounded-2xl border border-hub-border bg-hub-card">
            <div className="border-b border-hub-border px-4 py-3">
              <h3 className="text-sm font-semibold text-white">Cola Creative</h3>
              <p className="text-xs text-hub-muted">Requests · template_id siempre registrado</p>
            </div>
            {requests.length === 0 ? (
              <p className="px-4 py-8 text-sm text-hub-muted">
                Todavía no hay creatives. Publicá con Teo o generá manualmente arriba.
              </p>
            ) : (
              <ul className="max-h-[640px] divide-y divide-hub-border/70 overflow-y-auto">
                {requests.map((row) => {
                  const active = row.id === selected?.id;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={cn(
                          'w-full px-4 py-3 text-left transition',
                          active ? 'bg-orange-500/15' : 'hover:bg-[#0b1220]/50',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-white">{row.piece.title}</p>
                          <StatusBadge status={row.status} />
                        </div>
                        <p className="mt-1 text-xs text-hub-muted">
                          {row.assets[0]?.templateKey || 'sin asset'} ·{' '}
                          {new Date(row.createdAt).toLocaleString('es-AR')}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            {!selected ? (
              <p className="rounded-2xl border border-hub-border bg-hub-card px-4 py-10 text-center text-sm text-hub-muted">
                Seleccioná un request.
              </p>
            ) : (
              <>
                <div className="rounded-2xl border border-hub-border bg-hub-card p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-hub-muted">Preview</p>
                      <h3 className="text-lg font-semibold text-white">{selected.piece.title}</h3>
                    </div>
                    <StatusBadge status={selected.status} />
                  </div>

                  {assetUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={assetUrl}
                      alt="Creative preview"
                      className="mx-auto max-h-[520px] w-auto rounded-xl border border-hub-border/60 bg-[#0b1220]"
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-hub-border text-sm text-hub-muted">
                      {selected.status === 'failed' || selected.status === 'blocked'
                        ? selected.errorMessage || 'Sin asset'
                        : 'Sin preview todavía'}
                    </div>
                  )}

                  <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <p>
                      Template:{' '}
                      <span className="text-white">
                        {selected.assets[0]?.templateKey || plan?.templateKey || '—'}
                        {selected.assets[0]
                          ? `:v${selected.assets[0].templateVersion}`
                          : ''}
                      </span>
                    </p>
                    <p>
                      Formato: <span className="text-white">{selected.assets[0]?.format || plan?.format || '—'}</span>
                    </p>
                    <p>
                      Headline: <span className="text-white">{plan?.headline || '—'}</span>
                    </p>
                    <p>
                      CTA: <span className="text-white">{plan?.cta || '—'}</span>
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || selected.status !== 'preview'}
                      onClick={handleApprove}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleReprocess}
                      className="inline-flex items-center gap-2 rounded-xl border border-hub-border bg-[#0b1220] px-4 py-2 text-sm text-slate-200 disabled:opacity-50"
                    >
                      <RefreshCw className="h-4 w-4" /> Regenerar
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </CentroShell>
  );
}
