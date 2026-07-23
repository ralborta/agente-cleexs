'use client';

import { useCallback, useEffect, useState } from 'react';
import { ActivityFeed } from '@/components/centro/activity-feed';
import { buttonSecondaryClassName } from '@/components/config/settings-section';
import { CentroShell } from '@/components/shell/centro-shell';
import { fetchActivity } from '@/lib/api-client';

type FeedItem = {
  id: string;
  agent: string;
  role: string | null;
  message: string;
  level: string;
  createdAt: string;
};

export default function ActividadPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchActivity('cleexs', 60);
      setItems(
        data.activities.map((item) => ({
          id: item.id,
          agent: item.agent,
          role: item.role,
          message: item.missionTitle
            ? `${item.message}${item.message.endsWith('.') ? '' : '.'} [${item.missionTitle}]`
            : item.message,
          level: item.level,
          createdAt: item.createdAt,
        })),
      );
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <CentroShell workspaceName="Cleexs">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-white">Actividad</h2>
          <p className="mt-2 text-sm text-hub-muted">
            Feed completo de lo que hace Teo — transparencia, no operación manual.
          </p>
        </div>
        <button type="button" onClick={load} className={buttonSecondaryClassName}>
          Actualizar
        </button>
      </div>

      {loading && items.length === 0 ? (
        <p className="text-hub-muted">Cargando actividad…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-hub-border bg-hub-card p-8 text-center shadow-hub">
          <p className="text-white">Sin actividad registrada</p>
          <p className="mt-2 text-sm text-hub-muted">Cuando Teo ejecute misiones, los eventos aparecen acá.</p>
        </div>
      ) : (
        <ActivityFeed items={items} />
      )}
    </CentroShell>
  );
}
