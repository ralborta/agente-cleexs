import Link from 'next/link';
import { Megaphone, PenLine, Sparkles, type LucideIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { workspaceHref } from '@/lib/workspace';

export type AgentStatus = 'online' | 'working' | 'idle' | string;

export type AgentRosterItem = {
  slug: string;
  name: string;
  status: AgentStatus;
};

type Props = {
  workspace: string;
  agents: AgentRosterItem[];
  teoWorking?: boolean;
  publishedCount?: number;
  pendingApprovals?: number;
};

const ROSTER: Array<{
  slug: string;
  name: string;
  role: string;
  description: string;
  hrefSuffix: string;
  cta: string;
  icon: LucideIcon;
  accent: string;
  initials: string;
}> = [
  {
    slug: 'teo',
    name: 'Teo',
    role: 'Contenido AEO',
    description: 'Investiga, escribe, publica y refresca piezas en WordPress.',
    hrefSuffix: 'resultados',
    cta: 'Lanzar misión',
    icon: PenLine,
    accent: 'from-cleexs-blue/25 via-transparent to-transparent',
    initials: 'Te',
  },
  {
    slug: 'discovery',
    name: 'Discovery',
    role: 'Oportunidades',
    description: 'Detecta keywords, gaps y temas con potencial de demanda.',
    hrefSuffix: 'discovery',
    cta: 'Abrir Discovery',
    icon: Sparkles,
    accent: 'from-cleexs-violet/25 via-transparent to-transparent',
    initials: 'Di',
  },
  {
    slug: 'growth',
    name: 'Growth',
    role: 'Distribución',
    description: 'Lleva el contenido fuera del sitio: LinkedIn y creatives.',
    hrefSuffix: 'growth',
    cta: 'Abrir Growth',
    icon: Megaphone,
    accent: 'from-cleexs-orange/20 via-transparent to-transparent',
    initials: 'Gr',
  },
];

function statusMeta(status: AgentStatus, working?: boolean) {
  if (working || status === 'working') {
    return { label: 'Trabajando', variant: 'info' as const, pulse: true };
  }
  if (status === 'online') {
    return { label: 'En línea', variant: 'success' as const, pulse: true };
  }
  return { label: 'En espera', variant: 'outline' as const, pulse: false };
}

export function AgentRoster({
  workspace,
  agents,
  teoWorking,
  publishedCount = 0,
  pendingApprovals = 0,
}: Props) {
  const bySlug = Object.fromEntries(agents.map((a) => [a.slug, a]));

  return (
    <section className="animate-centro-in">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
            Equipo de agentes
          </p>
          <h3 className="mt-1 text-xl font-semibold text-white">Teo y compañía</h3>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {ROSTER.map((agent, index) => {
          const live = bySlug[agent.slug];
          const meta = statusMeta(
            live?.status || 'online',
            agent.slug === 'teo' ? teoWorking : false,
          );
          const Icon = agent.icon;
          const load =
            agent.slug === 'teo'
              ? Math.min(100, publishedCount * 8 + (teoWorking ? 24 : 0))
              : agent.slug === 'discovery'
                ? 42
                : 28;

          return (
            <Card
              key={agent.slug}
              className={cn(
                'group relative overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:border-cleexs-blue/45',
                'animate-centro-in',
              )}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div
                className={cn(
                  'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90',
                  agent.accent,
                )}
              />
              <CardHeader className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 ring-2 ring-cleexs-blue/30">
                      <AvatarFallback className="bg-hub-bg/80 text-white">
                        {agent.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <CardDescription>{agent.role}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={meta.variant} className="gap-1.5">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full bg-current',
                        meta.pulse && 'animate-pulse-dot',
                      )}
                    />
                    {meta.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-4">
                <p className="text-sm leading-relaxed text-slate-300">{agent.description}</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-hub-muted">
                    <span>Carga operativa</span>
                    <span className="tabular-nums text-slate-300">{load}%</span>
                  </div>
                  <Progress
                    value={load}
                    indicatorClassName={
                      agent.slug === 'growth'
                        ? 'bg-cleexs-orange'
                        : agent.slug === 'discovery'
                          ? 'bg-cleexs-violet'
                          : undefined
                    }
                  />
                </div>
                {agent.slug === 'teo' && pendingApprovals > 0 ? (
                  <p className="text-xs text-orange-200">
                    {pendingApprovals} entregable{pendingApprovals === 1 ? '' : 's'} en aprobación
                  </p>
                ) : null}
              </CardContent>
              <CardFooter className="relative justify-between gap-2 border-hub-border/80 bg-transparent">
                <div className="flex items-center gap-2 text-xs text-hub-muted">
                  <Icon className="h-3.5 w-3.5 text-cleexs-blue" />
                  Agente Cleexs
                </div>
                <Button asChild size="sm" variant={agent.slug === 'teo' ? 'default' : 'outline'}>
                  <Link href={workspaceHref(workspace, agent.hrefSuffix)}>{agent.cta}</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
