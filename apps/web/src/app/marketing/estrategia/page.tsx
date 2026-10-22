'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, CheckCircle2, Database, Loader2, Mail, Package, Sparkles, Target, Trash2, Wand2 } from 'lucide-react';
import { Badge, Card, Notice, PageHeader, btnGhost, btnGreen, btnPrimary, inputCls, useWorkspace } from '@/components/marketing/marketing-shell';
import {
  createMktCampaign, createMktCatalogItem, deleteMktCampaign, deleteMktCatalogItem, fetchMktCatalog, fetchMktOverview,
  generateMktEmail, proposeMktCampaign, updateMktCampaign,
  type MktCatalogItem, type MktGoal, type MktOverview,
} from '@/lib/marketing-client';

const STATUS: Record<string, { label: string; tone: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet' }> = {
  proposed: { label: 'Propuesta', tone: 'violet' },
  approved: { label: 'Aprobada', tone: 'blue' },
  active: { label: 'Activa', tone: 'green' },
  finished: { label: 'Finalizada', tone: 'slate' },
  archived: { label: 'Archivada', tone: 'slate' },
};

export default function EstrategiaPage() {
  const workspace = useWorkspace();
  const [data, setData] = useState<MktOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [audience, setAudience] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [catalog, setCatalog] = useState<MktCatalogItem[]>([]);
  const [goals, setGoals] = useState<MktGoal[]>([]);
  const [catKind, setCatKind] = useState<'servicio' | 'producto'>('servicio');
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catPrice, setCatPrice] = useState('');
  const [catAudience, setCatAudience] = useState('');
  const [propItem, setPropItem] = useState('');
  const [propGoal, setPropGoal] = useState('visibilidad');
  const [propAudience, setPropAudience] = useState('');
  const [propNotes, setPropNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, cat] = await Promise.all([fetchMktOverview(workspace), fetchMktCatalog(workspace)]);
      setData(overview);
      setCatalog(cat.items);
      setGoals(cat.goals);
      setPropItem((prev) => prev || cat.items.find((i) => i.active)?.id || '');
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar'); }
    finally { setLoading(false); }
  }, [workspace]);
  useEffect(() => { load(); }, [load]);

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key); setError(null); setMessage(null);
    try { await fn(); if (ok) setMessage(ok); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar'); }
    finally { setBusy(null); }
  }

  const calendar = useMemo(() => {
    if (!data) return [];
    return data.campaigns
      .filter((c) => c.startsAt || c.endsAt)
      .sort((a, b) => `${a.startsAt ?? ''}`.localeCompare(`${b.startsAt ?? ''}`));
  }, [data]);

  return (
    <>
      <PageHeader kicker="Agente de Estrategia de Marketing" title="Planificador de campañas">
        Propone campañas en base a tus servicios y productos: te pide objetivo y público, y obtiene solo las oportunidades
        de Rankear, las preguntas reales y tu contenido. Nada se ejecuta sin tu aprobación.
      </PageHeader>

      <Notice kind="ok" text={message} />
      <Notice kind="error" text={error} />

      {data && data.opportunities.length > 0 ? (
        <Card className="mb-6 border-violet-200 bg-violet-50/60">
          <h3 className="inline-flex items-center gap-2 font-bold text-slate-900"><Target className="h-4 w-4 text-violet-600" /> Oportunidades detectadas por Rankear</h3>
          <p className="mt-1 text-sm text-slate-500">Convertí una oportunidad en campaña propuesta con un clic. El Planificador arma objetivo y público.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.opportunities.map((opp) => (
              <button key={opp.id} type="button" disabled={busy === opp.id}
                onClick={() => run(opp.id, () => createMktCampaign(workspace, { opportunityId: opp.id }), `Campaña creada desde "${opp.keyword}".`)}
                className="rounded-full border border-violet-300 bg-white px-3 py-1.5 text-[13px] font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50">
                {busy === opp.id ? 'Creando…' : `+ ${opp.keyword}`}
              </button>
            ))}
          </div>
          <Link href="/marketing/visibilidad" className="mt-3 inline-block text-sm font-semibold text-violet-700 hover:underline">Ver todas en Rankear →</Link>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="inline-flex items-center gap-2 font-bold text-slate-900"><Package className="h-4 w-4 text-blue-600" /> Tus servicios y productos</h3>
          <p className="mt-1 text-sm text-slate-500">Esta es la base real del Planificador: propone campañas sobre lo que tu empresa vende, no sobre temas genéricos.</p>
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              {(['servicio', 'producto'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setCatKind(k)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${catKind === k ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-500 ring-slate-200'}`}>
                  {k === 'servicio' ? 'Servicio' : 'Producto'}
                </button>
              ))}
            </div>
            <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Nombre (ej: Sábanas de bambú / Consultoría AEO)" className={inputCls} />
            <textarea value={catDesc} onChange={(e) => setCatDesc(e.target.value)} rows={2} placeholder="Qué es, para quién y qué lo hace distinto" className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <input value={catPrice} onChange={(e) => setCatPrice(e.target.value)} placeholder="Precio / desde (opcional)" className={inputCls} />
              <input value={catAudience} onChange={(e) => setCatAudience(e.target.value)} placeholder="Público típico (opcional)" className={inputCls} />
            </div>
            <button type="button" disabled={busy === 'cat' || catName.trim().length < 2 || catDesc.trim().length < 5}
              onClick={() => run('cat', async () => {
                await createMktCatalogItem(workspace, { kind: catKind, name: catName, description: catDesc, priceText: catPrice || undefined, audience: catAudience || undefined });
                setCatName(''); setCatDesc(''); setCatPrice(''); setCatAudience('');
              }, 'Agregado al catálogo. Ya podés pedir una propuesta sobre esto.')}
              className={btnPrimary}>
              {busy === 'cat' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />} Agregar al catálogo
            </button>
          </div>
          {catalog.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100">
              {catalog.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.name} <span className="font-normal text-slate-400">· {item.kind}</span></p>
                    <p className="truncate text-xs text-slate-500">{item.description}</p>
                  </div>
                  <button type="button" onClick={() => run(`delcat-${item.id}`, () => deleteMktCatalogItem(workspace, item.id))} className="text-slate-300 hover:text-red-500" aria-label="Eliminar del catálogo"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-slate-400">Catálogo vacío: cargá tu primer servicio o producto.</p>}
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <h3 className="inline-flex items-center gap-2 font-bold text-slate-900"><Wand2 className="h-4 w-4 text-blue-600" /> Pedirle una propuesta al Planificador</h3>
          <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
            <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
              <p className="font-bold text-slate-900">Te pide</p>
              <ul className="mt-1 list-inside list-disc text-slate-500"><li>Qué servicio/producto impulsar</li><li>Tu objetivo</li><li>Público e indicaciones (opcional)</li></ul>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
              <p className="inline-flex items-center gap-1.5 font-bold text-slate-900"><Database className="h-3.5 w-3.5 text-blue-600" /> Obtiene solo</p>
              <ul className="mt-1 list-inside list-disc text-slate-500"><li>Oportunidades y demanda de Rankear</li><li>Preguntas reales de usuarios</li><li>Tu contenido ya creado y publicado</li></ul>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <select value={propItem} onChange={(e) => setPropItem(e.target.value)} className={inputCls}>
              <option value="">Elegí un servicio o producto…</option>
              {catalog.filter((i) => i.active).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.kind})</option>)}
            </select>
            <select value={propGoal} onChange={(e) => setPropGoal(e.target.value)} className={inputCls}>
              {goals.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
            <input value={propAudience} onChange={(e) => setPropAudience(e.target.value)} placeholder="Público puntual (opcional; si no, usa el del producto)" className={inputCls} />
            <textarea value={propNotes} onChange={(e) => setPropNotes(e.target.value)} rows={2} placeholder="Indicaciones: fechas, zonas, restricciones, tono…" className={inputCls} />
            <button type="button" disabled={busy === 'propose' || !propItem}
              onClick={() => run('propose', async () => {
                await proposeMktCampaign(workspace, { catalogItemId: propItem, goal: propGoal, audience: propAudience || undefined, notes: propNotes || undefined });
                setPropAudience(''); setPropNotes('');
              }, 'Propuesta creada abajo, en estado Propuesta. Revisala: trae objetivo, público y los datos que el sistema obtuvo.')}
              className={btnPrimary}>
              {busy === 'propose' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Que el Planificador proponga
            </button>
            {catalog.length === 0 ? <p className="text-xs text-amber-700">Primero cargá al menos un servicio o producto en el catálogo.</p> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <h3 className="font-bold text-slate-900">Nueva campaña</h3>
          <p className="mt-1 text-sm text-slate-500">Definí objetivo y público; el Planificador la deja en estado Propuesta.</p>
          <div className="mt-4 space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la campaña" className={inputCls} />
            <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={3} placeholder="Objetivo: qué queremos lograr y por qué ahora" className={inputCls} />
            <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Público / segmento (opcional)" className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-500">Desde<input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={`${inputCls} mt-1`} /></label>
              <label className="text-xs font-medium text-slate-500">Hasta<input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={`${inputCls} mt-1`} /></label>
            </div>
            <button type="button" disabled={busy === 'new' || title.trim().length < 3 || objective.trim().length < 5}
              onClick={() => run('new', async () => {
                await createMktCampaign(workspace, { title, objective, audience: audience || undefined, startsAt: startsAt ? new Date(startsAt).toISOString() : null, endsAt: endsAt ? new Date(endsAt).toISOString() : null });
                setTitle(''); setObjective(''); setAudience(''); setStartsAt(''); setEndsAt('');
              }, 'Campaña propuesta. Revisala y aprobala.')}
              className={btnPrimary}>
              {busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Proponer campaña
            </button>
          </div>

          {calendar.length > 0 ? (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h4 className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarRange className="h-4 w-4 text-blue-600" /> Calendario de acciones</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {calendar.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <span className="truncate font-medium text-slate-700">{c.title}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {c.startsAt ? new Date(c.startsAt).toLocaleDateString('es-AR') : '—'} → {c.endsAt ? new Date(c.endsAt).toLocaleDateString('es-AR') : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <div className="space-y-4 xl:col-span-3">
          {loading && !data ? <p className="text-sm text-slate-500">Cargando campañas…</p> : null}
          {data?.campaigns.length === 0 ? (
            <Card><p className="text-sm text-slate-500">Todavía no hay campañas. Creá la primera desde una oportunidad o con el formulario.</p></Card>
          ) : data?.campaigns.map((c) => {
            const st = STATUS[c.status] ?? { label: c.status, tone: 'slate' as const };
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{c.title}</p>
                    <p className="text-xs text-slate-400">{c.sourceType === 'catalog' ? `Desde tu catálogo: ${c.sourceLabel ?? ''}` : c.sourceLabel ? `Desde Rankear: ${c.sourceLabel}` : 'Creación manual'} · {c._count?.offers ?? 0} ofertas · {c._count?.emails ?? 0} emails</p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.objective}</p>
                {c.audience ? <p className="mt-1 text-[13px] text-slate-500">Público: {c.audience}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {c.status === 'proposed' ? <button type="button" disabled={busy === c.id} onClick={() => run(c.id, () => updateMktCampaign(workspace, c.id, { status: 'approved' }), 'Campaña aprobada.')} className={btnGreen}><CheckCircle2 className="h-3.5 w-3.5" /> Aprobar</button> : null}
                  {c.status === 'approved' ? <button type="button" disabled={busy === c.id} onClick={() => run(c.id, () => updateMktCampaign(workspace, c.id, { status: 'active' }), 'Campaña activa.')} className={btnGhost}>Activar</button> : null}
                  {c.status === 'active' ? <button type="button" disabled={busy === c.id} onClick={() => run(c.id, () => updateMktCampaign(workspace, c.id, { status: 'finished' }))} className={btnGhost}>Finalizar</button> : null}
                  <button type="button" disabled={busy === `mail-${c.id}`} onClick={() => run(`mail-${c.id}`, () => generateMktEmail(workspace, c.id), 'Email en borrador creado. Revisalo en Email Marketing.')} className={btnGhost}><Mail className="h-3.5 w-3.5" /> Generar email</button>
                  <Link href="/marketing/ofertas" className={btnGhost}>Crear oferta</Link>
                  <button type="button" disabled={busy === `del-${c.id}`} onClick={() => run(`del-${c.id}`, () => deleteMktCampaign(workspace, c.id))} className="ml-auto text-slate-300 hover:text-red-500" aria-label="Eliminar campaña"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
