import { formatRelativeTime } from '@/lib/utils';

const roleLabels: Record<string, string> = {
  strategist: 'Estratega',
  researcher: 'Researcher',
  journalist: 'Periodista',
  writer: 'Escritor',
  seo_builder: 'Albañil SEO',
  publisher: 'Publicador',
  refresher: 'Refrescador',
  contactor: 'Contactador',
};

type ActivityItem = {
  id: string;
  agent: string;
  role: string | null;
  message: string;
  level: string;
  createdAt: string;
};

const levelDot: Record<string, string> = {
  info: 'bg-cleexs-blue',
  success: 'bg-emerald-400',
  warning: 'bg-cleexs-orange',
  error: 'bg-red-400',
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-2xl border border-hub-border bg-hub-card p-5 shadow-hub">
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
          Actividad de agentes
        </p>
        <h3 className="text-lg font-semibold text-white">Teo en tiempo real</h3>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-hub-border/80 bg-[#172033] px-3 py-3"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${levelDot[item.level] || 'bg-cleexs-blue'}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {item.role ? roleLabels[item.role] || item.role : item.agent}
                  </span>
                  <span className="text-xs text-hub-muted">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{item.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
