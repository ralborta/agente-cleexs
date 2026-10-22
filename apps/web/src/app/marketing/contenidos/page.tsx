'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Badge, Card, PageHeader, Stat, useWorkspace } from '@/components/marketing/marketing-shell';
import { getStoredUser } from '@/lib/auth-client';
import { fetchMktContenidos, type MktContenidos } from '@/lib/marketing-client';

const STATUS: Record<string, { label: string; tone: 'slate' | 'green' | 'amber' | 'blue' | 'violet' }> = {
  idea: { label: 'Idea', tone: 'slate' },
  draft: { label: 'Borrador', tone: 'amber' },
  pending_approval: { label: 'En aprobación', tone: 'violet' },
  approved: { label: 'Aprobada', tone: 'blue' },
  published: { label: 'Publicada', tone: 'green' },
  refresh_needed: { label: 'A refrescar', tone: 'amber' },
  archived: { label: 'Archivada', tone: 'slate' },
};

export default function ContenidosPage() {
  const workspace = useWorkspace();
  const hub = `/${getStoredUser()?.workspaceSlug || workspace}`;
  const [data, setData] = useState<MktContenidos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMktContenidos(workspace).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }, [workspace]);

  return (
    <>
      <PageHeader kicker="Agente de Noticias y Contenidos" title="Contenidos">
        Genera y publica noticias, artículos y contenidos para tu web y redes. Estas son las piezas reales de tu marca:
        una noticia comunica y construye confianza; la acción comercial va por <Link href="/marketing/ofertas" className="font-semibold text-blue-600 hover:underline">Promociones</Link>.
      </PageHeader>

      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {!data && !error ? <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando contenidos…</p> : data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Piezas creadas" value={data.pieces.length} />
            <Stat label="Publicadas" value={data.byStatus.published ?? 0} hint={`${data.publications} publicaciones registradas`} />
            <Stat label="En aprobación" value={data.byStatus.pending_approval ?? 0} />
            <Stat label="A refrescar" value={data.byStatus.refresh_needed ?? 0} />
          </div>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900">Piezas de contenido</h3>
              <div className="flex gap-2">
                <Link href={`${hub}/aprobaciones`} className="text-sm font-semibold text-blue-600 hover:underline">Aprobar entregables</Link>
                <Link href={`${hub}/publicaciones`} className="text-sm font-semibold text-blue-600 hover:underline">Ver publicaciones</Link>
              </div>
            </div>
            {data.pieces.length === 0 ? (
              <p className="text-sm text-slate-500">Todavía no hay piezas. Se generan desde las oportunidades de Visibilidad.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.pieces.map((p) => {
                  const st = STATUS[p.status] ?? { label: p.status, tone: 'slate' as const };
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{p.title}</p>
                        <p className="text-xs text-slate-400">
                          {p.type}{p.cluster ? ` · ${p.cluster.name}` : ''}{p.keyword ? ` · ${p.keyword}` : ''} · {new Date(p.updatedAt).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.publication?.url ? (
                          <a href={p.publication.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 hover:underline">
                            Ver <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </>
  );
}
