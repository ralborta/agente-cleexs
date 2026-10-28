'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  Btn,
  Card,
  ConfigBadge,
  DataGate,
  EmptyState,
  Field,
  GhostBtn,
  Icon,
  Notice,
  PageHeader,
  Pill,
  Select,
  StatCard,
  Table,
  Tabs,
  TextArea,
  TextInput,
} from '@/components/ui';
import { displayName, fmtDate, fmtPct, pct } from '@/lib/metrics';
import {
  CUSTOM_PROMPTS_MAX,
  uid,
  useStore,
  type CustomPrompt,
  type FilteredData,
} from '@/lib/store';

type View = 'todos' | 'dentro' | 'fuera';

function blankCustom(): Omit<CustomPrompt, 'id' | 'updatedAt'> {
  return {
    text: '',
    name: '',
    tipoId: '',
    buyerId: '',
    ofertaId: '',
    country: '',
    active: true,
  };
}

function CustomPromptsPanel() {
  const { config, updateConfig } = useStore();
  const items = config.customPrompts ?? [];
  const [editing, setEditing] = useState<CustomPrompt | null>(null);
  const [isNew, setIsNew] = useState(false);
  const canAdd = items.length < CUSTOM_PROMPTS_MAX;

  const startNew = () => {
    if (!canAdd) return;
    setEditing({
      ...blankCustom(),
      id: uid('cprompt'),
      updatedAt: new Date().toISOString(),
      tipoId: config.tipos[0]?.id ?? '',
    });
    setIsNew(true);
  };

  const save = () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) return;
    const row: CustomPrompt = {
      ...editing,
      text,
      name: editing.name.trim() || text.slice(0, 60),
      updatedAt: new Date().toISOString(),
    };
    const next = isNew ? [...items, row] : items.map((x) => (x.id === row.id ? row : x));
    updateConfig({ customPrompts: next.slice(0, CUSTOM_PROMPTS_MAX) });
    setEditing(null);
    setIsNew(false);
  };

  const remove = (id: string) => {
    if (!confirm('¿Eliminar este prompt?')) return;
    updateConfig({ customPrompts: items.filter((x) => x.id !== id) });
    if (editing?.id === id) {
      setEditing(null);
      setIsNew(false);
    }
  };

  const tipoName = (id: string) => config.tipos.find((t) => t.id === id)?.name ?? '—';

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-fg font-semibold text-sm flex items-center gap-2">
            Prompts propios
            <ConfigBadge label={`máx. ${CUSTOM_PROMPTS_MAX}`} />
          </h3>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Podés sumar hasta {CUSTOM_PROMPTS_MAX} prompts adicionales y editarlos. Se usan para armar las próximas corridas junto a los prompts que Cleexs ya midió.
          </p>
        </div>
        <Btn type="button" onClick={startNew} disabled={!canAdd || !!editing}>
          <Icon name="plus" className="w-3.5 h-3.5" />
          Agregar prompt ({items.length}/{CUSTOM_PROMPTS_MAX})
        </Btn>
      </div>

      {!canAdd && !editing && (
        <Notice tone="amber">
          Ya tenés {CUSTOM_PROMPTS_MAX} prompts propios. Editá o borrá uno para agregar otro.
        </Notice>
      )}

      {editing && (
        <div className="rounded-xl border border-accent-cyan/30 bg-accent-cyan/5 p-4 mb-4 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent-cyan">
            {isNew ? 'Nuevo prompt' : 'Editar prompt'}
          </div>
          <Field label="Nombre corto (opcional)">
            <TextInput
              value={editing.name}
              placeholder="Ej. Comparativa firma electrónica PyME"
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </Field>
          <Field label="Texto del prompt" hint="Lo que se le pregunta a la IA">
            <TextArea
              rows={5}
              value={editing.text}
              placeholder="Escribí la consulta completa…"
              onChange={(e) => setEditing({ ...editing, text: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Tipo">
              <Select value={editing.tipoId} onChange={(e) => setEditing({ ...editing, tipoId: e.target.value })}>
                <option value="">Sin tipo</option>
                {config.tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Buyer persona">
              <Select value={editing.buyerId} onChange={(e) => setEditing({ ...editing, buyerId: e.target.value })}>
                <option value="">Sin buyer</option>
                {config.buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Oferta">
              <Select value={editing.ofertaId} onChange={(e) => setEditing({ ...editing, ofertaId: e.target.value })}>
                <option value="">Sin oferta</option>
                {config.ofertas.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="País">
              <TextInput
                value={editing.country}
                placeholder="Argentina"
                onChange={(e) => setEditing({ ...editing, country: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-fg">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              className="rounded border-line"
            />
            Activo para próximas corridas
          </label>
          <div className="flex gap-2">
            <Btn type="button" onClick={save} disabled={!editing.text.trim()}>
              <Icon name="check" className="w-3.5 h-3.5" /> Guardar
            </Btn>
            <GhostBtn
              type="button"
              onClick={() => {
                setEditing(null);
                setIsNew(false);
              }}
            >
              Cancelar
            </GhostBtn>
          </div>
        </div>
      )}

      {items.length === 0 && !editing ? (
        <EmptyState
          icon="chat"
          title="Todavía no hay prompts propios"
          body={`Podés agregar hasta ${CUSTOM_PROMPTS_MAX}. Los de Cleexs siguen en la tabla de abajo.`}
        />
      ) : (
        <Table head={['Prompt', 'Tipo', 'Buyer · Oferta', 'Estado', '']}>
          {items.map((p) => (
            <tr key={p.id} className="align-top">
              <td className="py-3 pr-4 max-w-md">
                <div className="text-fg font-medium">{p.name || 'Sin nombre'}</div>
                <div className="text-[11px] text-dim mt-1 line-clamp-2 whitespace-pre-wrap">{p.text}</div>
                <div className="text-[10px] text-dim mt-1">Actualizado {fmtDate(p.updatedAt, true)}</div>
              </td>
              <td className="py-3 pr-3">
                <Pill tone="purple">{tipoName(p.tipoId)}</Pill>
                {p.country ? <div className="text-[11px] text-dim mt-1">{p.country}</div> : null}
              </td>
              <td className="py-3 pr-3 text-xs text-muted">
                <div>{config.buyers.find((b) => b.id === p.buyerId)?.name ?? '—'}</div>
                <div>{config.ofertas.find((o) => o.id === p.ofertaId)?.name ?? '—'}</div>
              </td>
              <td className="py-3 pr-3">
                {p.active ? <Pill tone="green">Activo</Pill> : <Pill tone="slate">Pausado</Pill>}
              </td>
              <td className="py-3 whitespace-nowrap">
                <div className="flex gap-1">
                  <GhostBtn
                    type="button"
                    onClick={() => {
                      setEditing(p);
                      setIsNew(false);
                    }}
                    disabled={!!editing}
                    title="Editar"
                  >
                    <Icon name="edit" className="w-3.5 h-3.5" />
                  </GhostBtn>
                  <GhostBtn type="button" onClick={() => remove(p.id)} title="Eliminar">
                    <Icon name="trash" className="w-3.5 h-3.5" />
                  </GhostBtn>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

function AuditedPrompts({ d }: { d: FilteredData }) {
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

  if (!latest) {
    return <EmptyState icon="clock" title="Sin corridas para los filtros actuales" body="Ampliá el período o limpiá los filtros." />;
  }

  const inTop3 = prompts.filter((p) => p.brandInTop3).length;
  const first = prompts.filter((p) => p.brandPosition === 1).length;
  const tipos = new Set(prompts.map((p) => p.type).filter(Boolean));
  const setTag = (promptId: string, patch: { buyerId?: string; ofertaId?: string }) =>
    updateConfig({ promptTags: { ...config.promptTags, [promptId]: { ...config.promptTags[promptId], ...patch } } });

  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Prompts auditados" value={prompts.length} tone="fg" sub={`${tipos.size} tipos distintos`} />
        <StatCard label="Marca en Top 3" value={`${inTop3} / ${prompts.length}`} sub={fmtPct(pct(inTop3, prompts.length))} />
        <StatCard label="Posición #1" value={first} tone="teal" sub={fmtPct(pct(first, prompts.length)) + ' de los prompts'} />
        <StatCard label="Fuera del Top 3" value={prompts.length - inTop3} tone="amber" sub="Oportunidades de mejora" />
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-fg font-semibold text-sm">Prompts auditados por Cleexs</h3>
            <p className="text-xs text-muted mt-0.5">Corrida {fmtDate(latest.createdAt, true)} · solo lectura (resultados reales)</p>
          </div>
          <Tabs<View>
            tabs={[
              { id: 'todos', label: `Todos (${prompts.length})` },
              { id: 'dentro', label: `Marca en Top 3 (${inTop3})` },
              { id: 'fuera', label: `Fuera del Top 3 (${prompts.length - inTop3})` },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
        <div className="relative w-full sm:w-72 mb-4">
          <Icon name="search" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <TextInput className="pl-8" placeholder="Buscar por texto o tipo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {list.length === 0 ? (
          <EmptyState title="Ningún prompt coincide" body="Cambiá la vista o la búsqueda." />
        ) : (
          <Table
            head={[
              'Prompt / Consulta',
              'Tipo',
              'Visibilidad',
              'Motor',
              'Competidores en Top 3',
              <span key="t" className="inline-flex items-center gap-1.5">
                Buyer · Oferta <ConfigBadge label="local" />
              </span>,
            ]}
          >
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
                        <div className="text-[11px] text-dim mt-1">
                          {p.intent ?? p.name} · {isOpen ? 'ocultar detalle' : 'ver detalle'}
                        </div>
                      </button>
                    </td>
                    <td className="py-3 pr-3">
                      <Pill tone="purple">{p.type ?? '—'}</Pill>
                    </td>
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
                            <Pill key={r.name} tone="slate">
                              #{r.position} {displayName(r.name)}
                            </Pill>
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
                          {config.buyers.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </Select>
                        <Select value={tag.ofertaId ?? ''} onChange={(e) => setTag(p.promptId, { ofertaId: e.target.value || undefined })}>
                          <option value="">Sin oferta</option>
                          {config.ofertas.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
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
                              <pre className="whitespace-pre-wrap text-xs text-muted font-sans">
                                {p.responseExcerpt}
                                {p.responseExcerpt.length >= 700 ? '…' : ''}
                              </pre>
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
      </Card>
    </>
  );
}

function PromptsBody({ d }: { d: FilteredData }) {
  return (
    <>
      <PageHeader
        eyebrow="Registro"
        title="Prompts"
        badge={<Pill tone="slate">Hasta {CUSTOM_PROMPTS_MAX} propios + auditados Cleexs</Pill>}
        subtitle={`Agregá y editá hasta ${CUSTOM_PROMPTS_MAX} prompts propios. Abajo ves los que Cleexs ya midió para ${d.snapshot.brand.name}.`}
      />
      <CustomPromptsPanel />
      <AuditedPrompts d={d} />
    </>
  );
}

export default function Page() {
  const { isDefaultProject, snapshot } = useStore();
  // Si no hay snapshot Cleexs, igual permitimos gestionar prompts propios
  if (!isDefaultProject || snapshot.error || !snapshot.data) {
    return (
      <>
        <PageHeader
          eyebrow="Registro"
          title="Prompts"
          badge={<ConfigBadge label={`máx. ${CUSTOM_PROMPTS_MAX}`} />}
          subtitle={`Agregá y editá hasta ${CUSTOM_PROMPTS_MAX} prompts propios del proyecto.`}
        />
        <CustomPromptsPanel />
        {snapshot.loading ? (
          <EmptyState title="Cargando prompts auditados…" />
        ) : (
          <EmptyState title="Sin corridas Cleexs en este proyecto" body="Los prompts propios igual se guardan y se usan al programar corridas." />
        )}
      </>
    );
  }
  return <DataGate>{(d) => <PromptsBody d={d} />}</DataGate>;
}
