'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  BadgePercent,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  Megaphone,
  Newspaper,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import { getStoredUser } from '@/lib/auth-client';
import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';
import {
  createMarketingCampaign,
  createMarketingOffer,
  deleteMarketingCampaign,
  deleteMarketingEmail,
  deleteMarketingOffer,
  fetchMarketing,
  generateMarketingEmail,
  updateMarketingCampaign,
  updateMarketingEmail,
  updateMarketingOffer,
  type MarketingOverview,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

const AGENT_ICONS: Record<string, typeof Megaphone> = {
  planner: CalendarDays,
  email: Mail,
  content: Newspaper,
  offers: BadgePercent,
  visibility: Eye,
  outreach: Users,
  analytics: BarChart3,
};

const CAMPAIGN_STATUS: Record<string, string> = {
  proposed: 'Propuesta',
  approved: 'Aprobada',
  active: 'Activa',
  finished: 'Finalizada',
  archived: 'Archivada',
};

const OFFER_STATUS: Record<string, string> = {
  draft: 'Borrador',
  approved: 'Aprobada',
  active: 'Activa',
  expired: 'Vencida',
  archived: 'Archivada',
};

const inputCls =
  'w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white placeholder:text-slate-500';
const btnPrimary =
  'inline-flex items-center gap-2 rounded-xl bg-cleexs-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60';
const btnGhost =
  'rounded-lg border border-hub-border px-2.5 py-1 text-xs text-slate-300 hover:text-white';

export default function MarketingPage() {
  const workspace = useWorkspaceSlug();
  const workspaceName =
    getStoredUser()?.workspaceName || getStoredUser()?.workspaceSlug || 'Workspace';
  const [data, setData] = useState<MarketingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [campTitle, setCampTitle] = useState('');
  const [campObjective, setCampObjective] = useState('');
  const [campAudience, setCampAudience] = useState('');

  const [offerCampaignId, setOfferCampaignId] = useState('');
  const [offerTitle, setOfferTitle] = useState('');
  const [offerDesc, setOfferDesc] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerDiscount, setOfferDiscount] = useState('');
  const [offerTerms, setOfferTerms] = useState('');
  const [offerEnds, setOfferEnds] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchMarketing(workspace));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar Cleexs Marketing');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(key: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
      if (okMsg) setMessage(okMsg);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción');
    } finally {
      setBusy(null);
    }
  }

  return (
    <CentroShell workspaceName={workspaceName}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-cleexs-blue">
            <Megaphone className="h-4 w-4" /> Cleexs Marketing
          </p>
          <h2 className="mt-1 text-3xl font-semibold text-white">Campañas que nacen de tus datos</h2>
          <p className="mt-2 max-w-2xl text-sm text-hub-muted">
            {data?.tagline ??
              'Detectamos oportunidades, creamos tus campañas, las publicamos y medimos si funcionaron.'}{' '}
            La IA propone; vos aprobás antes de publicar o enviar.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-hub-border bg-hub-card px-3 py-2 text-sm text-slate-200 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" /> Recargar
        </button>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {data && !data.sendingEnabled ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <Mail className="mr-2 inline h-4 w-4" />
          {data.sendingNote}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="inline-flex items-center gap-2 text-hub-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando Cleexs Marketing…
        </p>
      ) : data ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            <Stat label="Campañas" value={data.summary.campaigns} hint={`${data.summary.campaignsActive} aprobadas/activas`} />
            <Stat label="Oportunidades abiertas" value={data.summary.opportunitiesOpen} hint="Detectadas por Visibilidad" />
            <Stat label="Ofertas activas" value={data.summary.offersActive} hint={`${data.summary.offers} en total`} />
            <Stat label="Emails en borrador" value={data.summary.emailsDraft} hint={`${data.summary.emailsApproved} aprobados · sin envío`} />
          </div>

          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
              Los 7 agentes
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.agents.map((agent) => {
                const Icon = AGENT_ICONS[agent.key] ?? Sparkles;
                return (
                  <Link
                    key={agent.key}
                    href={workspaceHref(workspace, agent.hrefSuffix)}
                    className="rounded-2xl border border-hub-border bg-hub-card p-4 transition hover:border-cleexs-blue/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-white">
                        <Icon className="h-4 w-4 text-cleexs-blue" />
                        <span className="font-semibold">{agent.name}</span>
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                          agent.mode === 'new'
                            ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                            : 'bg-sky-500/15 text-sky-200 ring-sky-500/30',
                        )}
                      >
                        {agent.mode === 'new' ? 'Nuevo v1' : agent.mode === 'shared' ? 'Compartido' : 'Ya operativo'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-400">{agent.shortName}</p>
                    <p className="mt-2 text-sm leading-relaxed text-hub-muted">{agent.description}</p>
                    <p className="mt-3 text-xs text-emerald-300">{agent.status}</p>
                  </Link>
                );
              })}
            </div>
          </section>

          {data.opportunities.length > 0 ? (
            <section className="mb-8 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                <Target className="h-4 w-4" /> Oportunidades detectadas → campaña en un clic
              </h3>
              <p className="mt-1 text-xs text-violet-200/80">
                El Planificador convierte cada oportunidad de visibilidad en una campaña propuesta.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.opportunities.map((opp) => (
                  <button
                    key={opp.id}
                    type="button"
                    disabled={busy === `opp-${opp.id}`}
                    onClick={() =>
                      run(`opp-${opp.id}`, () => createMarketingCampaign(workspace, { opportunityId: opp.id }), `Campaña creada desde "${opp.keyword}".`)
                    }
                    className="rounded-full border border-violet-400/40 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/20 disabled:opacity-60"
                  >
                    {busy === `opp-${opp.id}` ? 'Creando…' : `+ ${opp.keyword}`}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-hub-border bg-hub-card p-5">
              <h3 className="text-sm font-semibold text-white">Nueva campaña (Planificador)</h3>
              <div className="mt-3 space-y-3">
                <input value={campTitle} onChange={(e) => setCampTitle(e.target.value)} placeholder="Título de la campaña" className={inputCls} />
                <textarea value={campObjective} onChange={(e) => setCampObjective(e.target.value)} rows={3} placeholder="Objetivo: ¿qué queremos lograr y por qué ahora?" className={inputCls} />
                <input value={campAudience} onChange={(e) => setCampAudience(e.target.value)} placeholder="Público / segmento (opcional)" className={inputCls} />
                <button
                  type="button"
                  disabled={busy === 'camp' || campTitle.trim().length < 3 || campObjective.trim().length < 5}
                  onClick={() =>
                    run('camp', async () => {
                      await createMarketingCampaign(workspace, { title: campTitle, objective: campObjective, audience: campAudience || undefined });
                      setCampTitle(''); setCampObjective(''); setCampAudience('');
                    }, 'Campaña propuesta. Revisala y aprobala abajo.')
                  }
                  className={btnPrimary}
                >
                  {busy === 'camp' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Proponer campaña
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {data.campaigns.length === 0 ? (
                  <p className="text-sm text-hub-muted">Todavía no hay campañas. Creá la primera desde una oportunidad o manualmente.</p>
                ) : (
                  data.campaigns.map((c) => (
                    <article key={c.id} className="rounded-xl border border-hub-border bg-[#0b1220]/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-white">{c.title}</p>
                          <p className="text-xs text-hub-muted">
                            {CAMPAIGN_STATUS[c.status] ?? c.status}
                            {c.sourceLabel ? ` · desde: ${c.sourceLabel}` : ` · ${c.sourceType}`}
                            {c._count ? ` · ${c._count.offers} ofertas · ${c._count.emails} emails` : ''}
                          </p>
                        </div>
                        <button type="button" onClick={() => run(`del-c-${c.id}`, () => deleteMarketingCampaign(workspace, c.id))} className="text-slate-500 hover:text-red-300" aria-label="Eliminar campaña">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{c.objective}</p>
                      {c.audience ? <p className="mt-1 text-xs text-hub-muted">Público: {c.audience}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {c.status === 'proposed' ? (
                          <button type="button" disabled={busy === c.id} onClick={() => run(c.id, () => updateMarketingCampaign(workspace, c.id, { status: 'approved' }), 'Campaña aprobada.')} className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-100">
                            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Aprobar
                          </button>
                        ) : null}
                        {c.status === 'approved' ? (
                          <button type="button" disabled={busy === c.id} onClick={() => run(c.id, () => updateMarketingCampaign(workspace, c.id, { status: 'active' }), 'Campaña activada.')} className={btnGhost}>Activar</button>
                        ) : null}
                        {c.status === 'active' ? (
                          <button type="button" disabled={busy === c.id} onClick={() => run(c.id, () => updateMarketingCampaign(workspace, c.id, { status: 'finished' }))} className={btnGhost}>Finalizar</button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy === `mail-${c.id}`}
                          onClick={() => run(`mail-${c.id}`, () => generateMarketingEmail(workspace, c.id), 'Email en borrador creado por Campañas de email (sin envío).')}
                          className="rounded-lg bg-cleexs-blue/20 px-2.5 py-1 text-xs font-medium text-blue-100"
                        >
                          <Mail className="mr-1 inline h-3.5 w-3.5" /> Generar email
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <div className="space-y-6">
              <section className="rounded-2xl border border-hub-border bg-hub-card p-5">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <BadgePercent className="h-4 w-4 text-cleexs-blue" /> Nueva oferta (Ofertas y promociones)
                </h3>
                <p className="mt-1 text-xs text-hub-muted">Precio, condiciones y vigencia los confirma la empresa. Nada se publica sin aprobación.</p>
                <div className="mt-3 space-y-3">
                  <select value={offerCampaignId} onChange={(e) => setOfferCampaignId(e.target.value)} className={inputCls}>
                    <option value="">Sin campaña asociada</option>
                    {data.campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <input value={offerTitle} onChange={(e) => setOfferTitle(e.target.value)} placeholder="Título de la oferta" className={inputCls} />
                  <textarea value={offerDesc} onChange={(e) => setOfferDesc(e.target.value)} rows={2} placeholder="Descripción comercial" className={inputCls} />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="Precio (ej: $ 49.900)" className={inputCls} />
                    <input value={offerDiscount} onChange={(e) => setOfferDiscount(e.target.value)} placeholder="Beneficio (ej: 20% OFF)" className={inputCls} />
                  </div>
                  <input value={offerTerms} onChange={(e) => setOfferTerms(e.target.value)} placeholder="Condiciones (opcional)" className={inputCls} />
                  <label className="block text-xs text-hub-muted">
                    Vigente hasta
                    <input type="datetime-local" value={offerEnds} onChange={(e) => setOfferEnds(e.target.value)} className={cn(inputCls, 'mt-1')} />
                  </label>
                  <button
                    type="button"
                    disabled={busy === 'offer' || offerTitle.trim().length < 3 || offerDesc.trim().length < 5}
                    onClick={() =>
                      run('offer', async () => {
                        await createMarketingOffer(workspace, {
                          campaignId: offerCampaignId || null,
                          title: offerTitle,
                          description: offerDesc,
                          priceText: offerPrice || undefined,
                          discountText: offerDiscount || undefined,
                          terms: offerTerms || undefined,
                          endsAt: offerEnds ? new Date(offerEnds).toISOString() : null,
                        });
                        setOfferTitle(''); setOfferDesc(''); setOfferPrice(''); setOfferDiscount(''); setOfferTerms(''); setOfferEnds('');
                      }, 'Oferta en borrador. Aprobala para activarla por canal.')
                    }
                    className={btnPrimary}
                  >
                    {busy === 'offer' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgePercent className="h-4 w-4" />} Crear oferta
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {data.offers.map((o) => (
                    <article key={o.id} className="rounded-xl border border-hub-border bg-[#0b1220]/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium text-white">{o.title}</p>
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', o.derivedStatus === 'expired' ? 'bg-red-500/15 text-red-200 ring-red-500/30' : o.derivedStatus === 'active' || o.derivedStatus === 'approved' ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30' : 'bg-slate-500/15 text-slate-200 ring-slate-500/30')}>
                          {OFFER_STATUS[o.derivedStatus] ?? o.derivedStatus}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{o.description}</p>
                      <p className="mt-1 text-xs text-hub-muted">
                        {[o.priceText, o.discountText, o.endsAt ? `hasta ${new Date(o.endsAt).toLocaleString('es-AR')}` : null].filter(Boolean).join(' · ') || 'Sin precio/vigencia'}
                        {o.terms ? ` · ${o.terms}` : ''}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {o.derivedStatus === 'draft' ? (
                          <button type="button" onClick={() => run(o.id, () => updateMarketingOffer(workspace, o.id, { status: 'approved' }), 'Oferta aprobada.')} className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-100">Aprobar</button>
                        ) : null}
                        {o.derivedStatus === 'approved' ? (
                          <button type="button" onClick={() => run(o.id, () => updateMarketingOffer(workspace, o.id, { status: 'active' }), 'Oferta activa.')} className={btnGhost}>Activar</button>
                        ) : null}
                        <button type="button" onClick={() => run(`del-o-${o.id}`, () => deleteMarketingOffer(workspace, o.id))} className="text-slate-500 hover:text-red-300" aria-label="Eliminar oferta">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))}
                  {data.offers.length === 0 ? <p className="text-sm text-hub-muted">Sin ofertas todavía.</p> : null}
                </div>
              </section>

              <section className="rounded-2xl border border-hub-border bg-hub-card p-5">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <Mail className="h-4 w-4 text-cleexs-blue" /> Emails en borrador (Campañas de email)
                </h3>
                <p className="mt-1 text-xs text-hub-muted">Se generan desde una campaña. Aprobar no envía: el envío espera el dominio del cliente.</p>
                <div className="mt-4 space-y-3">
                  {data.emails.map((m) => (
                    <article key={m.id} className="rounded-xl border border-hub-border bg-[#0b1220]/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-white">{m.subject}</p>
                          <p className="text-xs text-hub-muted">{m.segment} · {m.status === 'approved' ? 'Aprobado (sin envío)' : m.status === 'discarded' ? 'Descartado' : 'Borrador'}</p>
                        </div>
                        <button type="button" onClick={() => run(`del-m-${m.id}`, () => deleteMarketingEmail(workspace, m.id))} className="text-slate-500 hover:text-red-300" aria-label="Eliminar email">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {m.preheader ? <p className="mt-1 text-xs text-slate-400">{m.preheader}</p> : null}
                      <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{m.body}</pre>
                      {m.status === 'draft' ? (
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => run(m.id, () => updateMarketingEmail(workspace, m.id, { status: 'approved' }), 'Email aprobado. No se envía hasta conectar el dominio del cliente.')} className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-100">Aprobar borrador</button>
                          <button type="button" onClick={() => run(m.id, () => updateMarketingEmail(workspace, m.id, { status: 'discarded' }))} className={btnGhost}>Descartar</button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {data.emails.length === 0 ? <p className="text-sm text-hub-muted">Sin borradores. Generá uno desde una campaña aprobada.</p> : null}
                </div>
              </section>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-hub-muted">
            Noticias y contenidos opera en{' '}
            <Link href={workspaceHref(workspace, 'publicaciones')} className="text-cleexs-blue underline">Publicaciones</Link>
            {' · '}Visibilidad en{' '}
            <Link href={workspaceHref(workspace, 'monitor')} className="text-cleexs-blue underline">Monitor</Link>
            {' · '}Resultados en{' '}
            <Link href={workspaceHref(workspace, 'resultados')} className="text-cleexs-blue underline">Resultados</Link>
            {' · '}Calendario en{' '}
            <Link href={workspaceHref(workspace, 'calendario')} className="text-cleexs-blue underline">Calendario</Link>
          </p>
        </>
      ) : null}
    </CentroShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-hub-border bg-hub-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-hub-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      <p className="text-xs text-hub-muted">{hint}</p>
    </div>
  );
}
