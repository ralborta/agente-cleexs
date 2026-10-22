'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgePercent, Loader2, Trash2 } from 'lucide-react';
import { Badge, Card, Notice, PageHeader, btnGhost, btnGreen, btnPrimary, inputCls, useWorkspace } from '@/components/marketing/marketing-shell';
import { createMktOffer, deleteMktOffer, fetchMktOverview, updateMktOffer, type MktOverview } from '@/lib/marketing-client';

const STATUS: Record<string, { label: string; tone: 'slate' | 'green' | 'red' | 'amber' }> = {
  draft: { label: 'Borrador', tone: 'amber' },
  approved: { label: 'Aprobada', tone: 'green' },
  active: { label: 'Activa', tone: 'green' },
  expired: { label: 'Vencida', tone: 'red' },
  archived: { label: 'Archivada', tone: 'slate' },
};
const CHANNELS = ['email', 'web', 'whatsapp', 'redes', 'linkedin'];

export default function OfertasPage() {
  const workspace = useWorkspace();
  const [data, setData] = useState<MktOverview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [terms, setTerms] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [channels, setChannels] = useState<string[]>(['email', 'web']);

  const load = useCallback(async () => {
    try { setData(await fetchMktOverview(workspace)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar'); }
  }, [workspace]);
  useEffect(() => { load(); }, [load]);

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key); setError(null); setMessage(null);
    try { await fn(); if (ok) setMessage(ok); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar'); }
    finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader kicker="Agente · Ofertas y Promociones" title="Ofertas y promociones">
        Crea promociones a partir de productos, precios y condiciones que vos aprobás. Cada oferta se adapta al canal y
        controla su vigencia: vencida la fecha, deja de ofrecerse sola.
      </PageHeader>

      <Notice kind="ok" text={message} />
      <Notice kind="error" text={error} />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <h3 className="font-bold text-slate-900">Nueva oferta</h3>
          <p className="mt-1 text-sm text-slate-500">Precio, condiciones y vencimiento los confirmás vos. Sin aprobación, no se publica.</p>
          <div className="mt-4 space-y-3">
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={inputCls}>
              <option value="">Sin campaña asociada</option>
              {data?.campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la oferta" className={inputCls} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Descripción comercial" className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio (ej: $ 49.900)" className={inputCls} />
              <input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Beneficio (ej: 20% OFF)" className={inputCls} />
            </div>
            <input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Condiciones (opcional)" className={inputCls} />
            <label className="block text-xs font-medium text-slate-500">Vigente hasta
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={`${inputCls} mt-1`} />
            </label>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">Canales</p>
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.map((ch) => (
                  <button key={ch} type="button"
                    onClick={() => setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch])}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${channels.includes(ch) ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-500 ring-slate-200 hover:ring-slate-300'}`}>
                    {ch}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" disabled={busy === 'new' || title.trim().length < 3 || description.trim().length < 5}
              onClick={() => run('new', async () => {
                await createMktOffer(workspace, { campaignId: campaignId || null, title, description, priceText: price || undefined, discountText: discount || undefined, terms: terms || undefined, channels, endsAt: endsAt ? new Date(endsAt).toISOString() : null });
                setTitle(''); setDescription(''); setPrice(''); setDiscount(''); setTerms(''); setEndsAt(''); setCampaignId('');
              }, 'Oferta en borrador. Aprobala para activarla.')}
              className={btnPrimary}>
              {busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgePercent className="h-4 w-4" />} Crear oferta
            </button>
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-3">
          {data?.offers.length === 0 ? (
            <Card><p className="text-sm text-slate-500">Sin ofertas todavía. Creá la primera con el formulario.</p></Card>
          ) : data?.offers.map((o) => {
            const st = STATUS[o.derivedStatus] ?? { label: o.derivedStatus, tone: 'slate' as const };
            return (
              <Card key={o.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold text-slate-900">{o.title}</p>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{o.description}</p>
                <p className="mt-2 text-[13px] text-slate-500">
                  {[o.priceText, o.discountText, o.endsAt ? `hasta el ${new Date(o.endsAt).toLocaleString('es-AR')}` : 'sin vencimiento', o.channels?.length ? `canales: ${o.channels.join(', ')}` : null].filter(Boolean).join(' · ')}
                </p>
                {o.terms ? <p className="mt-1 text-xs text-slate-400">Condiciones: {o.terms}</p> : null}
                <div className="mt-4 flex gap-2">
                  {o.derivedStatus === 'draft' ? <button type="button" disabled={busy === o.id} onClick={() => run(o.id, () => updateMktOffer(workspace, o.id, { status: 'approved' }), 'Oferta aprobada.')} className={btnGreen}>Aprobar</button> : null}
                  {o.derivedStatus === 'approved' ? <button type="button" disabled={busy === o.id} onClick={() => run(o.id, () => updateMktOffer(workspace, o.id, { status: 'active' }), 'Oferta activa en sus canales.')} className={btnGhost}>Activar</button> : null}
                  {o.derivedStatus === 'expired' ? <button type="button" disabled={busy === o.id} onClick={() => run(o.id, () => updateMktOffer(workspace, o.id, { status: 'archived' }))} className={btnGhost}>Archivar vencida</button> : null}
                  <button type="button" onClick={() => run(`del-${o.id}`, () => deleteMktOffer(workspace, o.id))} className="ml-auto text-slate-300 hover:text-red-500" aria-label="Eliminar oferta"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
