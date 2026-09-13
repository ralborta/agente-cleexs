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
    <Card className="animate-centro-in h-full" style={{ animationDelay: '200ms' }}>
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
          Actividad de agentes
        </p>
        <CardTitle>Teo en tiempo real</CardTitle>
        <CardDescription>Qué está haciendo el equipo ahora.</CardDescription>
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-hub-border px-3 py-8 text-center text-sm text-hub-muted">
            Cuando Teo ejecute misiones, los eventos aparecen acá.
          </p>
        ) : (
          <ol className="relative space-y-0 border-l border-hub-border pl-4">
            {items.slice(0, 12).map((item) => (
              <li key={item.id} className="relative pb-4 last:pb-0">
                <span
                  className={`absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-hub-card ${levelDot[item.level] || 'bg-cleexs-blue'}`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {item.role ? roleLabels[item.role] || item.role : item.agent}
                  </span>
                  <Badge variant="outline" className="font-normal">
                    {formatRelativeTime(item.createdAt)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-snug text-slate-300">{item.message}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
