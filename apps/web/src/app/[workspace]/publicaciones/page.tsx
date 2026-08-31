'use client';

import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';
import { getStoredUser } from '@/lib/auth-client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, CalendarDays, Loader2 } from 'lucide-react';
import { EcosystemPanel } from '@/components/content/ecosystem-panel';
import { IndexingStatusPanel } from '@/components/content/indexing-status-panel';
import { CentroShell } from '@/components/shell/centro-shell';
import {
  archivePiece,
  fetchContentClusters,
  fetchPieces,
  pieceAuthorName,
  resolvePublicationUrl,
  type ContentClusterSummary,
} from '@/lib/api-client';
import { TEO_AUTHOR_NAME } from '@/lib/branding';

export default function PublicacionesPage() {
  const workspace = useWorkspaceSlug();
  const workspaceName =
    getStoredUser()?.workspaceName || getStoredUser()?.workspaceSlug || 'Workspace';

  const [pieces, setPieces] = useState<Awaited<ReturnType<typeof fetchPieces>>['pieces']>([]);
  const [clusters, setClusters] = useState<ContentClusterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [piecesData, clustersData] = await Promise.all([
        fetchPieces(workspace),
        fetchContentClusters(workspace),
      ]);
      setPieces(piecesData.pieces.filter((p) => p.status === 'published'));
      setClusters(clustersData.clusters);
    } catch {
      setPieces([]);
      setClusters([]);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    load();
  }, [load]);

  const onArchive = async (pieceId: string, title: string) => {
    const ok = window.confirm(
      `¿Archivar «${title}»?\n\nSe archiva en Teo y el post pasa a la papelera de WordPress (recuperable desde WP).`,
    );
    if (!ok) return;
    setArchivingId(pieceId);
    setError(null);
    setMessage(null);
    try {
      const res = await archivePiece(pieceId, workspace);
      setPieces((prev) => prev.filter((p) => p.id !== pieceId));
      setMessage(
        res.wordpressTrashed
          ? 'Archivada en Teo y enviada a papelera de WordPress.'
          : res.wordpressWarning
            ? `Archivada en Teo. WP: ${res.wordpressWarning}`
            : 'Archivada en Teo.',
      );
      // refrescar clusters (conteos)
      fetchContentClusters(workspace)
        .then((d) => setClusters(d.clusters))
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo archivar');
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <CentroShell workspaceName={workspaceName}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Publicaciones</h2>
          <p className="mt-1 text-sm text-hub-muted">
            Piezas aprobadas y publicadas por {TEO_AUTHOR_NAME} en cleexs.net, organizadas en
            ecosistemas.
          </p>
        </div>
        <Link
          href={workspaceHref(workspace, "calendario")}
          className="inline-flex items-center gap-2 rounded-xl border border-hub-border bg-hub-card px-4 py-2 text-sm font-medium text-slate-200 hover:text-white"
        >
          <CalendarDays className="h-4 w-4" />
          Calendario
        </Link>
      </div>

      {message ? (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-hub-muted">Cargando…</p>
      ) : (
        <>
          <IndexingStatusPanel workspace={workspace} />
          <EcosystemPanel clusters={clusters} />

          {pieces.length === 0 ? (
            <div className="rounded-2xl border border-hub-border bg-hub-card p-8 text-center shadow-hub">
              <p className="text-white">Sin publicaciones todavía</p>
              <p className="mt-2 text-sm text-hub-muted">
                Lanzá una misión desde Monitor y aprobá la pieza para publicar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pieces.map((piece) => {
                const publicUrl = resolvePublicationUrl(piece.publication?.url, piece.slug);
                const busy = archivingId === piece.id;
                return (
                  <article
                    key={piece.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hub-border bg-hub-card p-5 shadow-hub"
                  >
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wide text-cleexs-blue">
                        {piece.type}
                        {piece.cluster?.name ? ` · ${piece.cluster.name}` : ''}
                      </span>
                      <h3 className="mt-1 text-lg font-semibold text-white">{piece.title}</h3>
                      <p className="mt-1 text-xs text-hub-muted">
                        Por {pieceAuthorName(piece, TEO_AUTHOR_NAME)}
                        {piece.publication?.publishedAt
                          ? ` · ${new Date(piece.publication.publishedAt).toLocaleDateString('es-AR')}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {publicUrl ? (
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noopener"
                          className="rounded-xl bg-cleexs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-cleexs-blue-dark"
                        >
                          Ver en WP
                        </a>
                      ) : (
                        <span className="text-xs text-hub-muted">Sin URL</span>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onArchive(piece.id, piece.title)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-hub-border px-3 py-2 text-sm text-slate-300 hover:border-red-500/40 hover:text-red-200 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                        Archivar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </CentroShell>
  );
}
