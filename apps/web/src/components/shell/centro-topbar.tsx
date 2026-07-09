'use client';

import { useEffect, useState } from 'react';
import { Search, Signal } from 'lucide-react';

type TopBarProps = {
  agentsOnline: number;
};

export function CentroTopBar({ agentsOnline }: TopBarProps) {
  const [now, setNow] = useState<string>('');

  useEffect(() => {
    const tick = () => {
      setNow(
        new Date().toLocaleString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="flex items-center gap-4 border-b border-hub-border bg-[#0b1220]/90 px-6 py-4 backdrop-blur">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hub-muted" />
        <input
          type="search"
          placeholder="Buscar piezas, misiones, URLs, keywords..."
          className="w-full rounded-xl border border-hub-border bg-hub-card py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-hub-muted focus:border-cleexs-blue focus:outline-none focus:ring-1 focus:ring-cleexs-blue"
        />
      </div>
      <div className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 md:flex">
        <Signal className="h-3.5 w-3.5" />
        {agentsOnline} agente{agentsOnline === 1 ? '' : 's'} en línea
      </div>
      <div className="rounded-xl border border-hub-border bg-hub-card px-3 py-2 text-sm font-medium text-slate-200">
        {now || '—'}
      </div>
    </header>
  );
}
