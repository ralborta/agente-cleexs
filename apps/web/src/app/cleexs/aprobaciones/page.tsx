'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApprovalReviewCard } from '@/components/approvals/approval-review-card';
import { CentroShell } from '@/components/shell/centro-shell';
import { fetchApprovals, type Approval } from '@/lib/api-client';

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

  function handlePieceUpdated(pieceId: string, piece: Approval['piece']) {
    setItems((prev) => prev.map((item) => (item.piece.id === pieceId ? { ...item, piece } : item)));
  }

  return (
    <CentroShell workspaceName="Cleexs" agentsOnline={1}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white">Aprobaciones</h2>
        <p className="mt-1 text-sm text-hub-muted">
          Revisá el preview, editá si hace falta y publicá en cleexs.net/articulos/ con un clic.
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
            <ApprovalReviewCard
              key={item.id}
              item={item}
              acting={acting === item.id}
              onActing={setActing}
              onUpdated={(piece) => handlePieceUpdated(item.piece.id, piece)}
              onDone={load}
              onError={setError}
              onSuccess={(msg) => {
                setSuccess(msg);
                setError(null);
              }}
            />
          ))}
        </div>
      )}
    </CentroShell>
  );
}
