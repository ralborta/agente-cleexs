'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Search, Send, XCircle } from 'lucide-react';
import {
  fetchIndexingStatus,
  publishIndexNowKey,
  submitIndexingUrl,
  type IndexingReport,
} from '@/lib/api-client';

function formatDate(iso: string | null) {
  if (!iso) return 'Sin datos';
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function submitBadge(status: string | null, label: string) {
  if (!status) return null;
  const ok = status === 'ok';
  const skipped = status === 'skipped';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        ok
          ? 'bg-emerald-500/15 text-emerald-400'
          : skipped
            ? 'bg-slate-500/20 text-slate-400'
            : 'bg-amber-500/15 text-amber-400'
      }`}
      title={label}
    >
      {label}: {status}
    </span>
  );
}

export function IndexingStatusPanel({ workspace }: { workspace: string }) {
  const [report, setReport] = useState<IndexingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      force ? setRefreshing(true) : setLoading(true);
      try {
        const res = await fetchIndexingStatus(workspace, force);
        setReport(res.indexing);
      } catch {
        setReport(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workspace],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function submitOne(pieceId: string) {
    setBusy(pieceId);
    setMessage(null);
    setError(null);
    try {
      const res = await submitIndexingUrl(workspace, { pieceId });
      const r = res.result;
      setMessage(
        r
          ? `GSC: ${r.gsc.detail} · IndexNow: ${r.indexNow.detail}`
          : 'Submit enviado',
      );
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al submitear');
    } finally {
      setBusy(null);
    }
  }

  async function submitPending() {
    setBusy('pending');
    setMessage(null);
    setError(null);
    try {
      const res = await submitIndexingUrl(workspace, { pending: true, onlyNotSubmitted: true });
      setMessage(`Submiteadas ${res.total ?? 0} URL(s) pendientes`);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al submitear pendientes');
    } finally {
      setBusy(null);
    }
  }

  async function publishKey() {
    setBusy('key');
    setMessage(null);
    setError(null);
    try {
      const res = await publishIndexNowKey(workspace);
      setMessage(
        `IndexNow key publicada · ${res.keyLocation}${
          res.pageUrl ? ` · página ${res.pageUrl}` : ''
        }. Instalá el mu-plugin si el .txt no responde.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al publicar key IndexNow');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="mb-6 rounded-2xl border border-hub-border bg-hub-card p-5 shadow-hub">
        <p className="text-sm text-hub-muted">Verificando indexación en Google…</p>
      </div>
    );
  }

  if (!report || !report.configured) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-hub-border bg-hub-card p-5 shadow-hub">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-cleexs-blue" />
          <h3 className="text-sm font-semibold text-white">Indexación en Google</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-hub-muted">
            {report.summary.indexed}/{report.summary.total} indexados
            {report.checkedAt ? ` · verificado ${formatDate(report.checkedAt)}` : ''}
          </span>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing || busy !== null}
            className="flex items-center gap-1.5 rounded-lg border border-hub-border px-2.5 py-1 text-xs text-hub-muted transition hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            Reverificar
          </button>
          <button
            type="button"
            onClick={submitPending}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-lg border border-cleexs-blue/40 bg-cleexs-blue/10 px-2.5 py-1 text-xs text-sky-200 transition hover:bg-cleexs-blue/20 disabled:opacity-50"
          >
            <Send className={`h-3 w-3 ${busy === 'pending' ? 'animate-pulse' : ''}`} />
            Submitear pendientes
          </button>
          {!report.submitReady?.indexNow ? (
            <button
              type="button"
              onClick={publishKey}
              disabled={busy !== null}
              className="rounded-lg border border-hub-border px-2.5 py-1 text-xs text-hub-muted hover:text-white disabled:opacity-50"
              title="Requiere INDEXNOW_KEY en Easypanel"
            >
              {busy === 'key' ? 'Publicando key…' : 'Publicar IndexNow key'}
            </button>
          ) : (
            <button
              type="button"
              onClick={publishKey}
              disabled={busy !== null}
              className="rounded-lg border border-hub-border px-2.5 py-1 text-xs text-hub-muted hover:text-white disabled:opacity-50"
            >
              Sync IndexNow key
            </button>
          )}
        </div>
      </div>

      {report.submitReady ? (
        <p className="mt-2 text-xs text-hub-muted">
          Submit: GSC Indexing {report.submitReady.googleIndexing ? 'listo' : 'sin SA'} · IndexNow{' '}
          {report.submitReady.indexNow ? 'listo' : 'falta INDEXNOW_KEY'}
          {report.submitReady.indexNowKeyLocation
            ? ` · ${report.submitReady.indexNowKeyLocation}`
            : ''}
        </p>
      ) : null}

      {message ? <p className="mt-2 text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

      {report.pages.length === 0 ? (
        <p className="mt-3 text-sm text-hub-muted">Sin publicaciones para verificar todavía.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {report.pages.map((page) => (
            <div
              key={page.pieceId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hub-border/60 bg-hub-bg/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{page.title}</p>
                <p className="truncate text-xs text-hub-muted">{page.url}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {submitBadge(page.gscSubmitStatus, 'GSC')}
                  {submitBadge(page.indexNowStatus, 'IndexNow')}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {page.lastCrawlTime ? (
                  <span className="text-hub-muted">Rastreado {formatDate(page.lastCrawlTime)}</span>
                ) : null}
                {page.indexed ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Indexado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 font-medium text-amber-400">
                    <XCircle className="h-3.5 w-3.5" /> {page.coverageState ?? 'No indexado'}
                  </span>
                )}
                {!page.indexed ? (
                  <button
                    type="button"
                    onClick={() => submitOne(page.pieceId)}
                    disabled={busy !== null}
                    className="rounded-lg border border-hub-border px-2 py-1 text-hub-muted hover:text-white disabled:opacity-50"
                  >
                    {busy === page.pieceId ? '…' : 'Submitear'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
