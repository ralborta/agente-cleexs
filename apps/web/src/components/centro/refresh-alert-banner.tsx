'use client';

import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';
import Link from 'next/link';
import { useState } from 'react';
import { retryRefreshPiece } from '@/lib/api-client';
import type { RadarPieceData } from './content-ecosystem-panel';

type Props = {
  pieces: RadarPieceData[];
  onRetried?: () => void;
};

export function RefreshAlertBanner({ pieces, onRetried }: Props) {
  const workspace = useWorkspaceSlug();
  const refreshPieces = pieces.filter((p) => p.status === 'refresh');

  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (refreshPieces.length === 0) return null;

  async function handleRetry(pieceId: string) {
    setRetryingId(pieceId);
    setError(null);
    try {
      const result = await retryRefreshPiece(workspace, pieceId);
      if (result.mission.skipped) {
        setError(
          result.mission.reason === 'mission_active'
            ? 'Hay otra misión activa. Esperá a que termine o revisá el Monitor.'
            : 'No se pudo encolar el refresco. Revisá el Monitor.',
        );
      } else {
        onRetried?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reintentar');
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="mb-6 space-y-3">
      {refreshPieces.map((piece) => (
        <div
          key={piece.id}
          className="rounded-xl border border-slate-500/30 bg-slate-500/10 px-4 py-3 text-sm text-slate-100"
        >
          <p className="font-semibold text-white">{piece.title}</p>
          {piece.refreshReason ? (
            <p className="mt-1 text-slate-300">{piece.refreshReason}</p>
          ) : null}
          {piece.lastRefreshMission?.status === 'failed' ? (
            <p className="mt-1 text-amber-200">
              El último intento de refresco falló. Teo no generó borrador para aprobación.
            </p>
          ) : piece.lastRefreshMission?.status === 'pending' ||
            piece.lastRefreshMission?.status === 'in_progress' ? (
            <p className="mt-1 text-blue-200">Refresco en curso — seguí el progreso en el Monitor.</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href={workspaceHref(workspace, "monitor")} className="font-semibold text-white underline">
              Ver Monitor
            </Link>
            {piece.lastRefreshMission?.status === 'failed' ||
            piece.lastRefreshMission?.status === 'cancelled' ||
            !piece.lastRefreshMission ? (
              <button
                type="button"
                disabled={retryingId === piece.id}
                onClick={() => handleRetry(piece.id)}
                className="font-semibold text-emerald-300 underline disabled:opacity-50"
              >
                {retryingId === piece.id ? 'Encolando…' : 'Reintentar refresco'}
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
