'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { fetchApprovals } from '@/lib/api-client';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  LineChart,
  LogOut,
  Plug,
  Radio,
  Settings,
  Sparkles,
  Target,
  Mic2,
  Megaphone,
} from 'lucide-react';
import { PLATFORM_NAME } from '@/lib/branding';
import { clearAuthSession, getStoredUser } from '@/lib/auth-client';
import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';
import { cn } from '@/lib/utils';

function buildNav(workspace: string) {
  const resultsNav = [
    { href: workspaceHref(workspace), label: 'Inicio', icon: LayoutDashboard },
    { href: workspaceHref(workspace, 'resultados'), label: 'Resultados', icon: BarChart3 },
    { href: workspaceHref(workspace, 'rendimiento'), label: 'Rendimiento', icon: LineChart },
    { href: workspaceHref(workspace, 'publicaciones'), label: 'Publicaciones', icon: FileText },
    { href: workspaceHref(workspace, 'calendario'), label: 'Calendario', icon: CalendarDays },
    { href: workspaceHref(workspace, 'oportunidades'), label: 'Oportunidades', icon: Target },
    { href: workspaceHref(workspace, 'actividad'), label: 'Actividad', icon: Activity },
  ];
  const agentsNav = [
    { href: workspaceHref(workspace, 'discovery'), label: 'Discovery', icon: Sparkles },
    { href: workspaceHref(workspace, 'growth'), label: 'Growth', icon: Megaphone },
    { href: workspaceHref(workspace, 'config/teo'), label: 'Teo · temas', icon: Settings },
  ];
  const operationNav = [
    { href: workspaceHref(workspace, 'aprobaciones'), label: 'Entregables', icon: CheckCircle2 },
    { href: workspaceHref(workspace, 'monitor'), label: 'Monitor', icon: Radio },
  ];
  const configNav = [
    { href: workspaceHref(workspace, 'voz'), label: 'Voz del founder', icon: Mic2 },
    { href: workspaceHref(workspace, 'integraciones'), label: 'Integraciones', icon: Plug },
  ];
  return { resultsNav, agentsNav, operationNav, configNav };
}

const agents = [
  { slug: 'discovery', name: 'Discovery', hrefSuffix: 'discovery', status: 'online' as const },
  { slug: 'growth', name: 'Growth', hrefSuffix: 'growth', status: 'online' as const },
  { slug: 'teo', name: 'Teo', hrefSuffix: 'config/teo', status: 'online' as const },
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

export function CentroSidebar({ workspaceName, pendingApprovals: pendingProp }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const workspace = useWorkspaceSlug();
  const storedUser = getStoredUser();
  const [pendingApprovals, setPendingApprovals] = useState(pendingProp ?? 0);
  const { resultsNav, agentsNav, operationNav, configNav } = useMemo(
    () => buildNav(workspace),
    [workspace],
  );

  useEffect(() => {
    if (pendingProp !== undefined) {
      setPendingApprovals(pendingProp);
      return;
    }
    fetchApprovals(workspace)
      .then((data) => setPendingApprovals(data.pendingCount))
      .catch(() => undefined);
  }, [pathname, pendingProp, workspace]);

  const operationWithBadge = operationNav.map((item) =>
    item.href.includes('aprobaciones')
      ? { ...item, badge: pendingApprovals }
      : item,
  );

  return (
    <aside className="flex h-screen w-[260px] shrink-0 flex-col border-r border-hub-border bg-[#0b1220] px-4 py-5">
      <div className="mb-6 shrink-0 px-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-hub-muted">
          {PLATFORM_NAME}
        </p>
        <h1 className="mt-1 text-lg font-semibold text-white">{workspaceName}</h1>
        <p className="mt-1 text-xs text-emerald-400">Teo + Discovery + Growth</p>
      </div>

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto pr-1">
        <NavSection title="Resultados" items={resultsNav} pathname={pathname} />
        <NavSection title="Agentes" items={agentsNav} pathname={pathname} />
        <NavSection title="Operación" items={operationWithBadge} pathname={pathname} />
        <NavSection title="Configuración" items={configNav} pathname={pathname} />
      </div>

      <div className="mt-4 shrink-0">
        <p className="mb-2 px-2 text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
          Estado
        </p>
        <div className="space-y-1">
          {agents.map((agent) => (
            <Link
              key={agent.slug}
              href={workspaceHref(workspace, agent.hrefSuffix)}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-hub-card hover:text-white"
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  agent.status === 'online' ? 'bg-emerald-400' : 'bg-slate-600',
                )}
              />
              <Sparkles className="h-4 w-4 text-cleexs-blue" />
              {agent.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between rounded-xl border border-hub-border bg-hub-card px-3 py-3">
        <div>
          <p className="text-sm font-medium text-white">{storedUser?.name ?? 'Administrador'}</p>
          <p className="text-xs text-hub-muted">{storedUser?.email ?? '—'}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearAuthSession();
            router.replace('/login');
          }}
          className="text-hub-muted hover:text-white"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
