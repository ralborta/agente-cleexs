'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  LogOut,
  Plug,
  Radio,
  Settings,
  Sparkles,
} from 'lucide-react';
import { PLATFORM_NAME, PLATFORM_SHORT } from '@/lib/branding';
import { cn } from '@/lib/utils';

/** Resultados primero — el agente trabaja solo, el cliente mide. */
const resultsNav = [
  { href: '/cleexs', label: PLATFORM_SHORT, icon: LayoutDashboard },
  { href: '/cleexs/resultados', label: 'Resultados', icon: BarChart3 },
  { href: '/cleexs/publicaciones', label: 'Publicaciones', icon: FileText },
  { href: '/cleexs/actividad', label: 'Actividad', icon: Activity },
];

/** Operación secundaria — transparencia y excepciones. */
const operationNav = [
  { href: '/cleexs/aprobaciones', label: 'Aprobaciones', icon: CheckCircle2 },
  { href: '/cleexs/monitor', label: 'Misiones', icon: Radio },
];

/** Configuración al final — se toca poco. */
const configNav = [
  { href: '/cleexs/config/teo', label: 'Temas y reglas Teo', icon: Settings },
  { href: '/cleexs/integraciones', label: 'Integraciones', icon: Plug },
];

const agents = [
  { slug: 'teo', name: 'Teo', status: 'online' as const },
  { slug: 'futuro', name: 'Agente 2', status: 'idle' as const },
];

type SidebarProps = {
  workspaceName: string;
  pendingApprovals?: number;
};

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: Array<{ href: string; label: string; icon: typeof LayoutDashboard; badge?: number }>;
  pathname: string;
}) {
  return (
    <div>
      <p className="mb-2 px-2 text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
        {title}
      </p>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                active
                  ? 'bg-cleexs-blue/15 text-white ring-1 ring-cleexs-blue/40'
                  : 'text-slate-300 hover:bg-hub-card hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="rounded-full bg-cleexs-orange/20 px-2 py-0.5 text-xs font-semibold text-cleexs-orange">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function CentroSidebar({ workspaceName, pendingApprovals = 0 }: SidebarProps) {
  const pathname = usePathname();

  const operationWithBadge = operationNav.map((item) =>
    item.href.includes('aprobaciones')
      ? { ...item, badge: pendingApprovals }
      : item,
  );

  return (
    <aside className="flex h-full min-h-screen w-[260px] flex-col border-r border-hub-border bg-[#0b1220] px-4 py-5">
      <div className="mb-8 px-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-hub-muted">
          {PLATFORM_NAME}
        </p>
        <h1 className="mt-1 text-lg font-semibold text-white">{workspaceName}</h1>
        <p className="mt-1 text-xs text-emerald-400">Teo activo · modo autónomo</p>
      </div>

      <div className="space-y-8">
        <NavSection title="Resultados" items={resultsNav} pathname={pathname} />
        <NavSection title="Excepciones" items={operationWithBadge} pathname={pathname} />
        <NavSection title="Configuración" items={configNav} pathname={pathname} />
      </div>

      <div className="mt-8">
        <p className="mb-2 px-2 text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
          Agentes
        </p>
        <div className="space-y-1">
          {agents.map((agent) => (
            <div
              key={agent.slug}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300"
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  agent.status === 'online' ? 'bg-emerald-400' : 'bg-slate-600',
                )}
              />
              <Sparkles className="h-4 w-4 text-cleexs-blue" />
              {agent.name}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between rounded-xl border border-hub-border bg-hub-card px-3 py-3">
        <div>
          <p className="text-sm font-medium text-white">Administrador</p>
          <p className="text-xs text-hub-muted">admin@cleexs.net</p>
        </div>
        <button type="button" className="text-hub-muted hover:text-white" aria-label="Cerrar sesión">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
