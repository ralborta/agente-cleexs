'use client';

import { useState } from 'react';
import { MessageSquare, ImageIcon, Sparkles } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import { getStoredUser } from '@/lib/auth-client';
import { useWorkspaceSlug } from '@/lib/workspace';
import { cn } from '@/lib/utils';
import { ConversationsPanel } from './conversations-panel';
import { CreativePanel } from './creative-panel';

type GrowthTab = 'conversaciones' | 'creativos';

export default function GrowthPage() {
  const workspace = useWorkspaceSlug();
  const workspaceName =
    getStoredUser()?.workspaceName || getStoredUser()?.workspaceSlug || 'Workspace';
  const [tab, setTab] = useState<GrowthTab>('conversaciones');

  return (
    <CentroShell workspaceName={workspaceName}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-100">
            <Sparkles className="h-3.5 w-3.5" />
            Agente Growth · comunicacional + creativos
          </div>
          <h2 className="text-3xl font-semibold text-white">Growth</h2>
          <p className="mt-2 max-w-2xl text-sm text-hub-muted">
            Lleva el contenido de Teo <strong className="font-medium text-slate-300">fuera del sitio</strong>.
            El módulo comunicacional encuentra conversaciones y prepara respuestas; Creative Engine arma
            piezas para LinkedIn.
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/15 via-hub-card to-hub-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-200">Activo · V1</p>
          <p className="mt-2 text-sm font-semibold text-white">Comunicacional</p>
          <p className="mt-1 text-xs text-hub-muted">Conversaciones → borradores. Publicación manual.</p>
        </div>
        <div className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/15 via-hub-card to-hub-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-200">Activo · V1</p>
          <p className="mt-2 text-sm font-semibold text-white">Creative Engine</p>
          <p className="mt-1 text-xs text-hub-muted">Templates → PNG. Canal inicial: LinkedIn.</p>
        </div>
        <div className="rounded-2xl border border-hub-border bg-hub-card p-4 opacity-70">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-hub-muted">Próximo</p>
          <p className="mt-2 text-sm font-semibold text-white">Publisher</p>
          <p className="mt-1 text-xs text-hub-muted">Publicar en LinkedIn (+ otros canales). Aún no.</p>
        </div>
        <div className="rounded-2xl border border-hub-border bg-hub-card p-4 opacity-70">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-hub-muted">Próximo</p>
          <p className="mt-2 text-sm font-semibold text-white">Performance</p>
          <p className="mt-1 text-xs text-hub-muted">CTR / reacciones por template y canal.</p>
        </div>
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-hub-border bg-[#0b1220] p-1">
        <button
          type="button"
          onClick={() => setTab('conversaciones')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
            tab === 'conversaciones'
              ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/30'
              : 'text-hub-muted hover:text-white',
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Comunicacional
        </button>
        <button
          type="button"
          onClick={() => setTab('creativos')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
            tab === 'creativos'
              ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/30'
              : 'text-hub-muted hover:text-white',
          )}
        >
          <ImageIcon className="h-4 w-4" />
          Creativos
        </button>
      </div>

      {tab === 'conversaciones' ? (
        <ConversationsPanel workspace={workspace} />
      ) : (
        <CreativePanel workspace={workspace} />
      )}
    </CentroShell>
  );
}
