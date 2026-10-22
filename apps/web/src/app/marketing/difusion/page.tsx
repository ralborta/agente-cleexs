'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Badge, Card, PageHeader, Stat, useWorkspace } from '@/components/marketing/marketing-shell';
import { fetchMktDifusion, type MktDifusion } from '@/lib/marketing-client';

const STATUS: Record<string, { label: string; tone: 'slate' | 'green' | 'amber' | 'blue' | 'violet' }> = {
  candidate: { label: 'Candidata', tone: 'amber' },
  recommended: { label: 'Recomendada', tone: 'violet' },
  approved: { label: 'Aprobada', tone: 'blue' },
  published: { label: 'Publicada', tone: 'green' },
  discarded: { label: 'Descartada', tone: 'slate' },
};

export default function DifusionPage() {
  const workspace = useWorkspace();
  const [data, setData] = useState<MktDifusion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMktDifusion(workspace).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }, [workspace]);

  return (
    <>
      <PageHeader kicker="Agente · Difusión y Alianzas" title="Oportunidades de difusión">
        Identifica medios, blogs, directorios y conversaciones donde tu marca debería aparecer, y prepara las
        propuestas de contacto. Publicar en un medio externo siempre requiere tu aprobación.
      </PageHeader>

      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {!data && !error ? <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando difusión…</p> : data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Oportunidades detectadas" value={data.opportunities.length} />
            <Stat label="Recomendadas" value={data.opportunities.filter((o) => o.editorialStatus === 'recommended').length} />
            <Stat label="Publicadas" value={data.opportunities.filter((o) => o.editorialStatus === 'published').length} />
            <Stat label="Exploraciones" value={data.runs.length} hint="Corridas de búsqueda de medios" />
          </div>

          <Card>
            <h3 className="mb-3 font-bold text-slate-900">Medios y conversaciones detectadas</h3>
            {data.opportunities.length === 0 ? (
              <p className="text-sm text-slate-500">
                Todavía no hay medios detectados. Las exploraciones se disparan cuando se publica contenido nuevo y el agente
                busca dónde difundirlo.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.opportunities.map((o) => {
                  const st = STATUS[o.editorialStatus] ?? { label: o.editorialStatus, tone: 'slate' as const };
                  return (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{o.conversation.title || o.conversation.domain}</p>
                        <p className="truncate text-xs text-slate-400">
                          {o.conversation.domain}{o.conversation.topic ? ` · ${o.conversation.topic}` : ''} · {o.drafts.length} borrador(es) de propuesta
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-slate-900">{Math.round(o.opportunityScore)}</span>
                        <a href={o.conversation.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 hover:underline">
                          Abrir <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {data.runs.length > 0 ? (
            <Card className="mt-4">
              <h3 className="mb-3 font-bold text-slate-900">Últimas exploraciones</h3>
              <ul className="space-y-2 text-sm">
                {data.runs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span className="text-slate-600">{new Date(r.createdAt).toLocaleString('es-AR')}</span>
                    <span className="text-slate-500">{r.opportunityCount} oportunidades · {r.status}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </>
  );
}
