import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
          Actividad de agentes
        </p>
        <CardTitle>Teo en tiempo real</CardTitle>
        <CardDescription>Feed operativo de la torre de control.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-xl border border-hub-border/80 bg-[#172033] px-3 py-4 text-sm text-hub-muted">
            Cuando Teo ejecute misiones, los eventos aparecen acá.
          </p>
        ) : (
          items.map((item) => (
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
                    <Badge variant="outline">{formatRelativeTime(item.createdAt)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{item.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
