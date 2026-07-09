'use client';

import { useCallback, useEffect, useState } from 'react';
import { CentroShell } from '@/components/shell/centro-shell';
import { fetchPieces, pieceAuthorName } from '@/lib/api-client';
import { TEO_AUTHOR_NAME } from '@/lib/branding';

export default function PublicacionesPage() {
  const [pieces, setPieces] = useState<Awaited<ReturnType<typeof fetchPieces>>['pieces']>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPieces('cleexs');
      setPieces(data.pieces.filter((p) => p.status === 'published'));
    } catch {
      setPieces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <CentroShell workspaceName="Cleexs">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white">Publicaciones</h2>
        <p className="mt-1 text-sm text-hub-muted">
          Piezas aprobadas y publicadas por {TEO_AUTHOR_NAME} en cleexs.net.
        </p>
      </div>

      {loading ? (
        <p className="text-hub-muted">Cargando…</p>
      ) : pieces.length === 0 ? (
        <div className="rounded-2xl border border-hub-border bg-hub-card p-8 text-center shadow-hub">
          <p className="text-white">Sin publicaciones todavía</p>
          <p className="mt-2 text-sm text-hub-muted">
            Lanzá una misión desde Resultados y aprobá la pieza para publicar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pieces.map((piece) => (
            <article
              key={piece.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hub-border bg-hub-card p-5 shadow-hub"
            >
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-cleexs-blue">
                  {piece.type}
                </span>
                <h3 className="mt-1 text-lg font-semibold text-white">{piece.title}</h3>
                <p className="mt-1 text-xs text-hub-muted">
                  Por {pieceAuthorName(piece, TEO_AUTHOR_NAME)}
                  {piece.publication?.publishedAt
                    ? ` · ${new Date(piece.publication.publishedAt).toLocaleDateString('es-AR')}`
                    : ''}
                </p>
              </div>
              {piece.publication?.url ? (
                <a
                  href={piece.publication.url}
                  target="_blank"
                  rel="noopener"
                  className="rounded-xl bg-cleexs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-cleexs-blue-dark"
                >
                  Ver en WP
                </a>
              ) : (
                <span className="text-xs text-hub-muted">Sin URL</span>
              )}
            </article>
          ))}
        </div>
      )}
    </CentroShell>
  );
}
