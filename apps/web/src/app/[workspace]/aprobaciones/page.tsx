'use client';

import { useWorkspaceSlug } from '@/lib/workspace';
import { getStoredUser } from '@/lib/auth-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApprovalReviewCard } from '@/components/approvals/approval-review-card';
import { CentroShell } from '@/components/shell/centro-shell';
import { fetchApprovals, type Approval } from '@/lib/api-client';

const WEEKLY_FOCUS = 4;

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // lunes=0
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy;
}

export default function AprobacionesPage() {
  const workspace = useWorkspaceSlug();
  const workspaceName =
    getStoredUser()?.workspaceName || getStoredUser()?.workspaceSlug || 'Workspace';

  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApprovals(workspace);
      setItems(data.approvals);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    load();
  }, [load]);

  function handlePieceUpdated(pieceId: string, piece: Approval['piece']) {
    setItems((prev) => prev.map((item) => (item.piece.id === pieceId ? { ...item, piece } : item)));
  }

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const thisWeek = useMemo(
    () => items.filter((a) => new Date(a.createdAt) >= weekStart),
    [items, weekStart],
  );

  const focusItems = showAll ? items : items.slice(0, WEEKLY_FOCUS);
  const remaining = Math.max(0, items.length - WEEKLY_FOCUS);

  return (
    <CentroShell workspaceName={workspaceName} agentsOnline={1}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Entregables de la semana</h2>
          <p className="mt-1 text-sm text-hub-muted">
            Cola lista para revisar, editar (sin aplanar tablas/gráficos) y publicar. Meta típica:{' '}
            {WEEKLY_FOCUS} piezas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-amber-500/15 px-3 py-1 font-medium text-amber-200 ring-1 ring-amber-500/30">
            Pendientes: {items.length}
          </span>
          <span className="rounded-full bg-sky-500/15 px-3 py-1 font-medium text-sky-200 ring-1 ring-sky-500/30">
            Esta semana: {thisWeek.length}
          </span>
        </div>
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
          <p className="text-white">No hay entregables pendientes</p>
          <p className="mt-2 text-sm text-hub-muted">
            Teo publicará aquí cuando genere contenido nuevo.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: WEEKLY_FOCUS }).map((_, i) => {
              const item = items[i];
              return (
                <div
                  key={i}
                  className={`rounded-xl border px-3 py-3 text-sm ${
                    item
                      ? 'border-cleexs-blue/40 bg-cleexs-blue/10 text-white'
                      : 'border-dashed border-hub-border bg-hub-card/50 text-hub-muted'
                  }`}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-hub-muted">
                    Slot {i + 1}
                  </p>
                  <p className="mt-1 line-clamp-2 font-medium">
                    {item ? item.piece.title : 'Libre — Teo puede generar'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            {focusItems.map((item) => (
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

          {!showAll && remaining > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-4 text-sm font-medium text-cleexs-blue hover:underline"
            >
              Ver {remaining} pendiente(s) más
            </button>
          ) : null}
          {showAll && items.length > WEEKLY_FOCUS ? (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="mt-4 text-sm font-medium text-hub-muted hover:text-white"
            >
              Mostrar solo los {WEEKLY_FOCUS} de foco
            </button>
          ) : null}
        </>
      )}
    </CentroShell>
  );
}
