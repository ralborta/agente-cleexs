'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BadgePercent,
  BarChart3,
  CalendarRange,
  Eye,
  Home,
  LogOut,
  Mail,
  Megaphone,
  Newspaper,
  Users,
} from 'lucide-react';
import { clearAuthSession, getAuthToken, getStoredUser } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/marketing', label: 'Inicio', icon: Home, exact: true },
  { href: '/marketing/estrategia', label: 'Planificador de campañas', icon: CalendarRange },
  { href: '/marketing/email', label: 'Campañas de email', icon: Mail },
  { href: '/marketing/contenidos', label: 'Noticias y contenidos', icon: Newspaper },
  { href: '/marketing/ofertas', label: 'Ofertas y promociones', icon: BadgePercent },
  { href: '/marketing/visibilidad', label: 'Visibilidad en IA y Google', icon: Eye },
  { href: '/marketing/difusion', label: 'Oportunidades de difusión', icon: Users },
  { href: '/marketing/resultados', label: 'Resultados y mejoras', icon: BarChart3 },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const user = getStoredUser();
  const workspaceSlug = user?.workspaceSlug || 'cleexs';
  const workspaceName = user?.workspaceName || workspaceSlug;

  useEffect(() => {
    if (!getAuthToken() || !getStoredUser()) {
      window.location.replace(`/login?next=${encodeURIComponent(pathname || '/marketing')}`);
      return;
    }
    setReady(true);
  }, [pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fb] text-sm text-slate-500">
        Verificando sesión…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] font-sans text-slate-900 antialiased">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex">
          <div className="px-2">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
              <Megaphone className="h-4 w-4" /> Cleexs
            </p>
            <h1 className="mt-1 text-[22px] font-bold leading-tight text-slate-900">Cleexs Marketing</h1>
            <p className="mt-1 text-[13px] leading-snug text-slate-500">
              Detectar oportunidades, generar campañas, publicarlas y medir sus resultados.
            </p>
          </div>

          <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Agentes</p>
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <Link href={`/${workspaceSlug}`} className="inline-flex items-center gap-2 px-2 text-[13px] font-medium text-slate-500 hover:text-blue-600">
              <ArrowLeft className="h-4 w-4" /> Volver al centro de agentes
            </Link>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{workspaceName}</p>
                <p className="truncate text-xs text-slate-500">{user?.email ?? ''}</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar sesión"
                onClick={() => { clearAuthSession(); router.replace('/login'); }}
                className="text-slate-400 hover:text-slate-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 lg:hidden">
              <p className="inline-flex items-center gap-2 font-bold text-slate-900">
                <Megaphone className="h-4 w-4 text-blue-600" /> Cleexs Marketing
              </p>
              <Link href={`/${workspaceSlug}`} className="text-sm font-medium text-blue-600">Centro de agentes</Link>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} className={cn('whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium', active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <main className="mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-7">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">{kicker}</p>
      <h2 className="mt-1 text-[28px] font-bold leading-tight text-slate-900">{title}</h2>
      {children ? <div className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-500">{children}</div> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]', className)}>{children}</section>;
}

export function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-[26px] font-bold leading-none text-slate-900">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet' }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1', tones[tone])}>{children}</span>;
}

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
export const btnPrimary =
  'inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
export const btnGhost =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50';
export const btnGreen =
  'inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50';

export function useWorkspace(): string {
  return getStoredUser()?.workspaceSlug || 'cleexs';
}

export function Notice({ kind, text }: { kind: 'ok' | 'error'; text: string | null }) {
  if (!text) return null;
  return (
    <div className={cn('mb-5 rounded-xl border px-4 py-3 text-sm', kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700')}>
      {text}
    </div>
  );
}
