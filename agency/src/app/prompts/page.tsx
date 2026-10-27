'use client';

import { Fragment, useMemo, useState } from 'react';
import { Card, ConfigBadge, DataGate, EmptyState, PageHeader, Pill, Select, StatCard, Table, Tabs, TextInput, Icon } from '@/components/ui';
import { displayName, fmtDate, fmtPct, pct } from '@/lib/metrics';
import { useStore, type FilteredData } from '@/lib/store';

type View = 'todos' | 'dentro' | 'fuera';

function Prompts({ d }: { d: FilteredData }) {
  const { config, updateConfig } = useStore();
  const { snapshot: snap, latest, prompts } = d;
  const [view, setView] = useState<View>('todos');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const modelLabel = (m: string | null) => snap.llms.find((l) => l.model === m)?.label ?? m ?? '—';
  const list = useMemo(
    () =>
      prompts.filter((p) => {
        if (view === 'dentro' && !p.brandInTop3) return false;
        if (view === 'fuera' && p.brandInTop3) return false;
        if (q && !(p.text + p.name).toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [prompts, view, q],
  );

  if (!latest) return <EmptyState icon="clock" title="Sin corridas para los filtros actuales" body="Ampliá el período o limpiá los filtros." />;

  const inTop3 = prompts.filter((p) => p.brandInTop3).length;
  const first = prompts.filter((p) => p.brandPosition === 1).length;
  const tipos = new Set(prompts.map((p) => p.type).filter(Boolean));
  const setTag = (promptId: string, patch: { buyerId?: string; ofertaId?: string }) =>
    updateConfig({ promptTags: { ...config.promptTags, [promptId]: { ...config.promptTags[promptId], ...patch } } });

  return (
    <>
      <PageHeader
        eyebrow="Registro"
        title="Registro de prompts auditados"
        badge={<Pill tone="slate">Corrida {fmtDate(latest.createdAt, true)}</Pill>}
        subtitle={`Prompts ejecutados por Cleexs contra la IA para medir la presencia de ${snap.brand.name}. La visibilidad de cada prompt indica si la marca entró al Top 3.`}
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Prompts auditados" value={prompts.length} tone="fg" sub={`${tipos.size} tipos distintos`} />
        <StatCard label="Marca en Top 3" value={`${inTop3} / ${prompts.length}`} sub={fmtPct(pct(inTop3, prompts.length))} />
        <StatCard label="Posición #1" value={first} tone="teal" sub={fmtPct(pct(first, prompts.length)) + ' de los prompts'} />
        <StatCard label="Fuera del Top 3" value={prompts.length - inTop3} tone="amber" sub="Oportunidades de mejora" />
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Tabs<View>
            tabs={[
              { id: 'todos', label: `Todos (${prompts.length})` },
              { id: 'dentro', label: `Marca en Top 3 (${inTop3})` },
              { id: 'fuera', label: `Fuera del Top 3 (${prompts.length - inTop3})` },
            ]}
            value={view}
            onChange={setView}
          />
          <div className="relative w-72">
            <Icon name="search" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <TextInput className="pl-8" placeholder="Buscar por texto o tipo de prompt…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {list.length === 0 ? (
          <EmptyState title="Ningún prompt coincide" body="Cambiá la vista o la búsqueda." />
        ) : (
          <Table head={['Prompt / Consulta', 'Tipo', 'Visibilidad', 'Motor', 'Competidores en Top 3', <span key="t" className="inline-flex items-center gap-1.5">Buyer · Oferta <ConfigBadge label="local" /></span>]}>
            {list.map((p) => {
              const rivals = p.top3.filter((e) => e.type !== 'brand');
              const tag = config.promptTags[p.promptId] ?? {};
              const isOpen = open === p.id;
              return (
                <Fragment key={p.id}>
                  <tr className="align-top">
                    <td className="py-3 pr-4 max-w-md">
                      <button type="button" className="text-left" onClick={() => setOpen(isOpen ? null : p.id)}>
                        <div className="text-fg font-medium line-clamp-2">{p.text.split('\n')[1] || p.text.split('\n')[0] || p.name}</div>
                        <div className="text-[11px] text-dim mt-1">{p.intent ?? p.name} · {isOpen ? 'ocultar detalle' : 'ver detalle'}</div>
                      </button>
                    </td>
                    <td className="py-3 pr-3"><Pill tone="purple">{p.type ?? '—'}</Pill></td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {p.brandInTop3 ? (
                        <Pill tone="green">Top 3 · #{p.brandPosition}</Pill>
                      ) : (
                        <Pill tone="red">Fuera del Top 3</Pill>
                      )}
                      <div className="text-[11px] text-dim mt-1">score {p.score.toFixed(2).replace('.', ',')}</div>
                    </td>
                    <td className="py-3 pr-3">{modelLabel(p.model)}</td>
                    <td className="py-3 pr-3">
                      {rivals.length ? (
                        <div className="flex flex-wrap gap-1">
                          {rivals.map((r) => (
                            <Pill key={r.name} tone="slate">#{r.position} {displayName(r.name)}</Pill>
                          ))}
                        </div>
                      ) : (
                        <span className="text-dim">Ninguno</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1.5 min-w-[150px]">
                        <Select value={tag.buyerId ?? ''} onChange={(e) => setTag(p.promptId, { buyerId: e.target.value || undefined })}>
                          <option value="">Sin buyer</option>
                          {config.buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </Select>
                        <Select value={tag.ofertaId ?? ''} onChange={(e) => setTag(p.promptId, { ofertaId: e.target.value || undefined })}>
                          <option value="">Sin oferta</option>
                          {config.ofertas.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </Select>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="pb-4">
                        <div className="rounded-xl bg-surface2 border border-line p-4 space-y-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Prompt ejecutado</div>
                            <pre className="whitespace-pre-wrap text-xs text-fg font-sans">{p.text}</pre>
                          </div>
                          {p.responseExcerpt && (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Respuesta de la IA (extracto)</div>
                              <pre className="whitespace-pre-wrap text-xs text-muted font-sans">{p.responseExcerpt}{p.responseExcerpt.length >= 700 ? '…' : ''}</pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </Table>
        )}
        {config.buyers.length === 0 && config.ofertas.length === 0 && (
          <p className="text-[11px] text-dim mt-3">Creá buyer personas y ofertas en sus secciones para etiquetar prompts y usar esos filtros.</p>
        )}
      </Card>
    </>
  );
}

export default function Page() {
  return <DataGate>{(d) => <Prompts d={d} />}</DataGate>;
}
