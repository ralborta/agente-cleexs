'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BadgePercent, BarChart3, CalendarRange, Eye, Loader2, Mail, Newspaper, Users } from 'lucide-react';
import { Badge, Card, PageHeader, Stat, useWorkspace } from '@/components/marketing/marketing-shell';
import { fetchMktOverview, type MktOverview } from '@/lib/marketing-client';

const ICONS: Record<string, typeof Mail> = {
  estrategia: CalendarRange, email: Mail, contenidos: Newspaper, ofertas: BadgePercent,
  visibilidad: Eye, difusion: Users, resultados: BarChart3,
};

const CAMPAIGN_STATUS: Record<string, string> = { proposed: 'Propuesta', approved: 'Aprobada', active: 'Activa', finished: 'Finalizada', archived: 'Archivada' };

export default function MarketingHomePage() {
  const workspace = useWorkspace();
  const [data, setData] = useState<MktOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMktOverview(workspace).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }, [workspace]);

  return (
    <>
      <PageHeader kicker="Cleexs Marketing" title={`Marketing de ${data?.workspaceName ?? 'tu empresa'}`}>
        Detectamos oportunidades, creamos tus campañas, las publicamos y medimos si funcionaron. Cada campaña nace de una
        oportunidad real detectada por Cleexs — no de una plantilla genérica. La IA propone; vos aprobás.
      </PageHeader>

      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {!data && !error ? (
        <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando tu marketing…</p>
      ) : data ? (
        <>
          {data.cleexs?.configured ? (
            <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl border border-blue-200 bg-blue-50/60 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Cleexs Score · {data.cleexs.snapshot.brand.name}</p>
                <p className="text-4xl font-extrabold leading-none text-blue-700">{data.cleexs.snapshot.cleexsScore != null ? Math.round(data.cleexs.snapshot.cleexsScore) : '—'}<span className="text-base font-semibold text-blue-400"> / 100</span></p>
              </div>
              <p className="max-w-xl text-sm text-slate-600">
                Dato real de Cleexs{data.cleexs.snapshot.latest ? `: aparece en el top 3 en el ${data.cleexs.snapshot.latest.brandInTop3Pct}% de ${data.cleexs.snapshot.latest.promptsAnalyzed} consultas analizadas` : ''}.
                {data.cleexs.snapshot.brand.competitors.length ? ` Competidores medidos: ${data.cleexs.snapshot.brand.competitors.map((c) => c.name).join(', ')}.` : ''}
              </p>
              <a href="/marketing/visibilidad" className="ml-auto text-sm font-semibold text-blue-700 hover:underline">Ver en Rankear →</a>
            </div>
          ) : data.cleexs ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-800">
              <strong>Datos de Cleexs sin conectar.</strong> {data.cleexs.reason}
            </div>
          ) : null}

          <div className="mb-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Oportunidades abiertas" value={data.summary.opportunitiesOpen} hint="Detectadas por Rankear" />
            <Stat label="Campañas" value={data.summary.campaigns} hint={`${data.summary.campaignsApprovedOrActive} aprobadas o activas`} />
            <Stat label="Contenidos publicados" value={data.summary.publications} hint={`${data.summary.pieces} piezas creadas`} />
            <Stat label="Emails en borrador" value={data.summary.emailsDraft} hint={`${data.summary.emailsApproved} aprobados · sin envío`} />
          </div>

          <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-slate-500">Tus 7 agentes</h3>
          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.agents.map((agent) => {
              const Icon = ICONS[agent.key] ?? ArrowRight;
              return (
                <Link key={agent.key} href={agent.route} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:border-blue-300 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-5 w-5" /></span>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
                  </div>
                  <p className="mt-3 font-bold text-slate-900">{agent.name}</p>
                  <p className="text-xs font-medium text-slate-400">{agent.origin}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{agent.description}</p>
                </Link>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Últimas campañas</h3>
                <Link href="/marketing/estrategia" className="text-sm font-semibold text-blue-600 hover:underline">Planificador</Link>
              </div>
              {data.campaigns.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no hay campañas. El Planificador crea la primera desde una oportunidad detectada.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.campaigns.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{c.title}</p>
                        <p className="truncate text-xs text-slate-500">{c.sourceLabel ? `Desde: ${c.sourceLabel}` : c.sourceType}</p>
                      </div>
                      <Badge tone={c.status === 'active' ? 'green' : c.status === 'approved' ? 'blue' : 'slate'}>{CAMPAIGN_STATUS[c.status] ?? c.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h3 className="mb-3 font-bold text-slate-900">Cómo trabaja el sistema</h3>
              <ol className="space-y-3 text-sm leading-relaxed text-slate-600">
                <li><strong className="text-slate-900">1. Rankear detecta</strong> dónde tu marca aparece poco en IA y Google.</li>
                <li><strong className="text-slate-900">2. El Planificador propone</strong> una campaña sobre esa oportunidad, con objetivo y público.</li>
                <li><strong className="text-slate-900">3. Contenidos, Ofertas y Email ejecutan</strong> la pieza, la promoción y la secuencia — siempre en borrador.</li>
                <li><strong className="text-slate-900">4. Vos aprobás</strong> antes de que algo se publique o se envíe.</li>
                <li><strong className="text-slate-900">5. Resultados mide</strong> y recomienda qué repetir, ajustar o detener.</li>
              </ol>
              {!data.sendingEnabled ? (
                <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800 ring-1 ring-amber-200">{data.sendingNote}</p>
              ) : null}
            </Card>
          </div>
        </>
      ) : null}
    </>
  );
}
