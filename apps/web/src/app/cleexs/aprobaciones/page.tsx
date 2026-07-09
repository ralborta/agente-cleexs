'use client';

import { useCallback, useEffect, useState } from 'react';
import { CentroShell } from '@/components/shell/centro-shell';
import { approvePiece, fetchApprovals, pieceAuthorName, rejectPiece, type Approval } from '@/lib/api-client';
import { TEO_AUTHOR_NAME } from '@/lib/branding';

export default function AprobacionesPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApprovals('cleexs');
      setItems(data.approvals);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(id: string) {
    setActing(id);
    setSuccess(null);
    try {
      const res = await approvePiece(id, 'draft');
      setSuccess(`Publicado en WordPress (${res.wordpress.status}): ${res.wordpress.url}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aprobar');
    } finally {
      setActing(null);
    }
  }

  async function handleReject(id: string) {
    setActing(id);
    try {
      await rejectPiece(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al rechazar');
    } finally {
      setActing(null);
    }
  }

  return (
    <CentroShell workspaceName="Cleexs" agentsOnline={1}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white">Aprobaciones</h2>
        <p className="mt-1 text-sm text-hub-muted">
          Teo trabaja solo. Acá solo revisás y aprobás antes de publicar en cleexs.net.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      {loading ? (
        <p className="text-hub-muted">Cargando cola…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-hub-border bg-hub-card p-8 text-center shadow-hub">
          <p className="text-white">No hay piezas pendientes</p>
          <p className="mt-2 text-sm text-hub-muted">Teo publicará aquí cuando genere contenido nuevo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-hub-border bg-hub-card p-6 shadow-hub"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-cleexs-blue">
                    {item.piece.type}
                  </span>
                  <h3 className="mt-1 text-lg font-semibold text-white">{item.piece.title}</h3>
                  <p className="mt-1 text-xs text-hub-muted">
                    Por {pieceAuthorName(item.piece, TEO_AUTHOR_NAME)}
                  </p>
                  <p className="mt-2 text-sm text-hub-muted">
                    {item.piece.content?.excerpt || 'Sin extracto'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={acting === item.id}
                    onClick={() => handleApprove(item.id)}
                    className="rounded-xl bg-cleexs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-cleexs-blue-dark disabled:opacity-50"
                  >
                    {acting === item.id ? 'Publicando…' : 'Aprobar → WP'}
                  </button>
                  <button
                    type="button"
                    disabled={acting === item.id}
                    onClick={() => handleReject(item.id)}
                    className="rounded-xl border border-hub-border px-4 py-2 text-sm text-slate-300 hover:bg-hub-border/30 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
              {item.piece.content?.html ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-cleexs-blue">Ver preview HTML</summary>
                  <div
                    className="prose prose-invert mt-3 max-w-none overflow-auto rounded-xl border border-hub-border bg-white p-4 text-slate-900"
                    dangerouslySetInnerHTML={{ __html: item.piece.content.html }}
                  />
                </details>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </CentroShell>
  );
}
