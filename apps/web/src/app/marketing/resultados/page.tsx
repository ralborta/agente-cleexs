'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Lightbulb, Loader2 } from 'lucide-react';
import { Card, PageHeader, Stat, useWorkspace } from '@/components/marketing/marketing-shell';
import { fetchMktResultados, type MktResultados } from '@/lib/marketing-client';

const LEVEL_TONE: Record<string, string> = {
  alta: 'bg-red-50 text-red-700 ring-red-200',
  media: 'bg-amber-50 text-amber-700 ring-amber-200',
  baja: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="space-y-1.5">
        {entries.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
            <span className="text-slate-600">{k}</span>
            <span className="font-semibold tabular-nums text-slate-900">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ResultadosPage() {
  const workspace = useWorkspace();
  const [data, setData] = useState<MktResultados | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMktResultados(workspace).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }, [workspace]);

  return (
    <>
      <PageHeader kicker="Agente de Análisis de Resultados" title="Analítica">
        Mide el desempeño de tus campañas, ofertas, contenidos y difusión, y te recomienda qué repetir, ajustar o
        detener. Sin datos inventados: todo sale de tu actividad real.
      </PageHeader>

      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {!data && !error ? <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando resultados…</p> : data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Campañas" value={data.counts.campaigns} />
            <Stat label="Publicaciones" value={data.counts.publications} hint={`${data.counts.pieces} piezas creadas`} />
            <Stat label="Ofertas" value={data.counts.offers} hint={data.counts.offersExpired > 0 ? `${data.counts.offersExpired} vencida(s)` : 'Ninguna vencida'} />
            <Stat label="Oportunidades de difusión" value={data.counts.diffusionOpportunities} />
          </div>

          <Card className="mb-4">
            <h3 className="mb-4 inline-flex items-center gap-2 font-bold text-slate-900"><Lightbulb className="h-4 w-4 text-amber-500" /> Recomendaciones del agente</h3>
            <ul className="space-y-3">
              {data.recommendations.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${LEVEL_TONE[r.level]}`}>
                    Prioridad {r.level}
                  </span>
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-600">{r.text}</p>
                  <Link href={r.route} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
                    Ir <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="mb-4 font-bold text-slate-900">Detalle por agente</h3>
            <div className="grid gap-6 md:grid-cols-3">
              <Breakdown title="Campañas por estado" data={data.counts.campaignsByStatus} />
              <Breakdown title="Emails por estado" data={data.counts.emailsByStatus} />
              <Breakdown title="Contenidos por estado" data={data.counts.piecesByStatus} />
            </div>
            <p className="mt-5 rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">
              La evolución de visibilidad en IA y Google se sigue en{' '}
              <Link href="/marketing/visibilidad" className="font-semibold text-blue-600 hover:underline">Rankear</Link>:
              cuando una campaña actúa sobre una consulta, ahí se ve si la marca empieza a aparecer.
            </p>
          </Card>
        </>
      ) : null}
    </>
  );
}
