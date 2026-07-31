'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Search, XCircle } from 'lucide-react';
import { fetchIndexingStatus, type IndexingReport } from '@/lib/api-client';

function formatDate(iso: string | null) {
  if (!iso) return 'Sin datos';
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function IndexingStatusPanel({ workspace }: { workspace: string }) {
  const [report, setReport] = useState<IndexingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        <div className="flex items-center gap-3">
          <span className="text-xs text-hub-muted">
            {report.summary.indexed}/{report.summary.total} indexados
            {report.checkedAt ? ` · verificado ${formatDate(report.checkedAt)}` : ''}
          </span>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-hub-border px-2.5 py-1 text-xs text-hub-muted transition hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            Reverificar
          </button>
        </div>
      </div>

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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
