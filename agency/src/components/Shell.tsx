'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { StoreProvider, useStore, PERIODOS } from '@/lib/store';
import { Icon, Pill, type IconName } from './ui';

type NavItem = { href: string; label: string; icon: IconName };
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Monitoreo',
    items: [
      { href: '/', label: 'Dashboard', icon: 'dashboard' },
      { href: '/competidores', label: 'Competidores', icon: 'clock' },
      { href: '/fuentes', label: 'Fuentes', icon: 'link' },
      { href: '/sentimiento', label: 'Sentimiento', icon: 'face' },
    ],
  },
  {
    group: 'Protocolo Centinela',
    items: [
      { href: '/centinela', label: 'Historial de alertas', icon: 'bell' },
      { href: '/centinela/reglas', label: 'Reglas de alerta', icon: 'shield' },
    ],
  },
  {
    group: 'Mitigación GEO',
    items: [
      { href: '/geo/mitigacion', label: 'Flujo de mitigación', icon: 'bolt' },
      { href: '/geo/confirmacion', label: 'Confirmación', icon: 'check' },
      { href: '/geo/reauditoria', label: 'Re-auditoría día 14', icon: 'refresh' },
      { href: '/geo/resultado', label: 'Resultado 48 h', icon: 'history' },
    ],
  },
  {
    group: 'Setup',
    items: [
      { href: '/nuevo-proyecto', label: 'Nuevo proyecto', icon: 'plus' },
      { href: '/corridas', label: 'Corridas', icon: 'clock' },
    ],
  },
  {
    group: 'Registro',
    items: [
      { href: '/prompts', label: 'Prompts', icon: 'chat' },
      { href: '/ofertas', label: 'Ofertas', icon: 'tag' },
      { href: '/buyer-personas', label: 'Buyer personas', icon: 'user' },
      { href: '/tipos-prompt', label: 'Tipos de prompt', icon: 'list' },
      { href: '/marcas', label: 'Marcas', icon: 'flag' },
      { href: '/proyecto', label: 'Proyecto', icon: 'sliders' },
    ],
  },
];

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const path = usePathname() || '/';
  const { theme, setTheme, projectName, projectDomain, projects, activeProjectId, setActiveProject, isDefaultProject, snapshot } = useStore();
  const isActive = (href: string) => path === href;

  if (collapsed) {
    return (
      <aside className="w-14 shrink-0 bg-surface2 border-r border-line min-h-screen flex flex-col items-center py-4 gap-4 sticky top-0 h-screen">
        <button type="button" onClick={onToggle} aria-label="Expandir menú" className="w-8 h-8 rounded-lg bg-accent-cyan flex items-center justify-center text-bg font-bold">
          C
        </button>
        <nav className="flex flex-col gap-1 overflow-y-auto">
          {NAV.flatMap((g) => g.items).map((i) => (
            <Link key={i.href} href={i.href} title={i.label} className={`p-2 rounded-lg ${isActive(i.href) ? 'bg-accent-cyan/10 text-accent-cyan' : 'text-dim hover:text-fg'}`}>
              <Icon name={i.icon} />
            </Link>
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 bg-surface2 border-r border-line flex flex-col justify-between sticky top-0 h-screen" data-purpose="sidebar-navigation">
      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-cyan flex items-center justify-center text-bg font-bold text-base shadow-lg shadow-accent-cyan/20">C</div>
            <span className="text-fg font-semibold text-base tracking-tight">AI Visibility</span>
          </div>
          <button type="button" onClick={onToggle} aria-label="Colapsar menú" className="text-dim hover:text-fg p-1">
            <Icon name="chevronLeft" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5 px-0.5">
          <div className="text-[12px] text-muted">
            Proyecto: <span className="text-fg font-medium">{projectName}</span>
            {projectDomain && <span className="text-dim"> · {projectDomain}</span>}
          </div>
          {projects.length > 0 && (
            <select
              value={activeProjectId}
              onChange={(e) => setActiveProject(e.target.value)}
              className="rounded-lg bg-surface border border-line text-[11px] text-fg px-2 py-1"
              aria-label="Cambiar proyecto"
            >
              <option value="cleexs-default">{snapshot.data?.brand.name ?? 'Cleexs'} (Cleexs API)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (local)
                </option>
              ))}
            </select>
          )}
          <div>
            {isDefaultProject ? (
              snapshot.error ? (
                <Pill tone="red">Sin conexión a Cleexs</Pill>
              ) : (
                <Pill tone="green">Datos reales de Cleexs</Pill>
              )
            ) : (
              <Pill tone="amber">Proyecto local · sin datos</Pill>
            )}
          </div>
        </div>

        <nav className="flex flex-col gap-4 mt-1">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="text-[10px] font-bold text-dim tracking-wider uppercase mb-1.5 px-2">{g.group}</div>
              <div className="space-y-0.5">
                {g.items.map((i) => {
                  const active = isActive(i.href);
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors ${
                        active
                          ? 'border border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan font-medium'
                          : 'border border-transparent text-muted hover:text-fg hover:bg-line/30'
                      }`}
                    >
                      <Icon name={i.icon} className={`w-4 h-4 ${active ? 'text-accent-cyan' : ''}`} />
                      <span>{i.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="p-3 border-t border-line">
        <div className="bg-surface p-1 rounded-xl flex items-center border border-line text-xs">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors ${
                theme === t ? 'bg-surface2 text-fg border border-line font-medium shadow-sm' : 'text-muted hover:text-fg border border-transparent'
              }`}
            >
              <Icon name={t === 'light' ? 'sun' : 'moon'} className="w-3.5 h-3.5" />
              <span>{t === 'light' ? 'Claro' : 'Oscuro'}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function FilterPill({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold tracking-wider text-muted uppercase">{label}</span>
      {children}
    </div>
  );
}

const pillSelect =
  'appearance-none pl-3.5 pr-7 py-1.5 bg-surface border border-line rounded-full text-fg text-xs cursor-pointer hover:border-dim focus:outline-none focus:border-accent-cyan/60 bg-no-repeat';

function FilterBar() {
  const { filters, setFilters, resetFilters, config, data, snapshot, reload, isDefaultProject } = useStore();
  const [iaOpen, setIaOpen] = useState(false);
  const snap = snapshot.data;

  const iaOptions = snap?.llms.map((l) => l.label) ?? [];
  const paises = Array.from(new Set([snap?.brand.country, ...(snap?.history.map((r) => r.country) ?? [])].filter(Boolean) as string[]));
  const tiposData = Array.from(new Set(snap?.prompts.map((p) => p.type).filter(Boolean) as string[]));
  const tipoNames = Array.from(new Set([...config.tipos.map((t) => t.name), ...tiposData]));
  void data;

  const iaLabel = filters.ia.length === 0 ? 'Todas' : filters.ia.length === 1 ? filters.ia[0] : `${filters.ia[0]} +${filters.ia.length - 1}`;

  return (
    <header className="px-6 pt-6 pb-2" data-purpose="top-filter-bar">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <FilterPill label="IA">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIaOpen((o) => !o)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-surface border border-accent-purple/40 rounded-full text-fg text-xs hover:border-accent-purple/70"
              >
                <span className="font-medium">{iaLabel}</span>
                <Icon name="chevronDown" className="w-3.5 h-3.5 text-dim" />
              </button>
              {iaOpen && (
                <div className="absolute z-20 mt-1 min-w-[180px] rounded-xl border border-line bg-surface p-2 shadow-xl">
                  {iaOptions.length === 0 && <div className="text-dim text-xs p-2">Sin modelos con datos</div>}
                  {iaOptions.map((o) => {
                    const on = filters.ia.includes(o);
                    return (
                      <label key={o} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-line/30 cursor-pointer text-xs text-fg">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setFilters({ ia: on ? filters.ia.filter((x) => x !== o) : [...filters.ia, o] })}
                        />
                        {o}
                      </label>
                    );
                  })}
                  <button type="button" className="text-[11px] text-accent-cyan px-2 pt-1" onClick={() => { setFilters({ ia: [] }); setIaOpen(false); }}>
                    Todas
                  </button>
                </div>
              )}
            </div>
          </FilterPill>

          <FilterPill label="Buyer persona">
            <select className={pillSelect} value={filters.buyer} onChange={(e) => setFilters({ buyer: e.target.value })}>
              <option value="">Todos</option>
              {config.buyers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </FilterPill>
          <FilterPill label="Oferta">
            <select className={pillSelect} value={filters.oferta} onChange={(e) => setFilters({ oferta: e.target.value })}>
              <option value="">Todas</option>
              {config.ofertas.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </FilterPill>
          <FilterPill label="Tipo de prompt">
            <select className={pillSelect} value={filters.tipo} onChange={(e) => setFilters({ tipo: e.target.value })}>
              <option value="">Todos</option>
              {tipoNames.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FilterPill>
          <FilterPill label="País">
            <select className={pillSelect} value={filters.pais} onChange={(e) => setFilters({ pais: e.target.value })}>
              <option value="">Todos</option>
              {paises.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </FilterPill>
        </div>

        <div className="flex items-end gap-3">
          <FilterPill label="Período">
            <select
              className={pillSelect}
              value={filters.periodo ?? ''}
              onChange={(e) => setFilters({ periodo: e.target.value ? Number(e.target.value) : null })}
            >
              {PERIODOS.map((p) => (
                <option key={p.label} value={p.days ?? ''}>{p.label}</option>
              ))}
            </select>
          </FilterPill>
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-muted hover:text-fg">
            <Icon name="x" className="w-3 h-3" /> Limpiar
          </button>
          <button type="button" onClick={reload} disabled={!isDefaultProject} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-muted hover:text-fg disabled:opacity-40">
            <Icon name="refresh" className="w-3 h-3" /> {snapshot.loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>
      {(filters.buyer || filters.oferta) && (
        <p className="text-[11px] text-dim mt-2">
          Buyer persona y oferta filtran por las etiquetas que asignes a cada prompt en <Link href="/prompts" className="text-accent-cyan hover:underline">Prompts</Link> (config local).
        </p>
      )}
    </header>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-screen bg-bg text-muted font-sans text-[13px]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main className="flex-1 flex flex-col min-w-0">
        <FilterBar />
        <div className="p-6 pt-4 flex-1">{children}</div>
        <footer className="px-6 pb-4 text-[11px] text-dim flex justify-between">
          <span>Cleexs Agency · datos servidos por la API de Cleexs</span>
          <span>Visibilidad = % de prompts donde la marca aparece en el Top 3</span>
        </footer>
      </main>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <Frame>{children}</Frame>
    </StoreProvider>
  );
}
