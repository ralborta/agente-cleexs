'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Btn, Card, CardTitle, ConfigBadge, Field, GhostBtn, Icon, Notice, PageHeader, Pill, Select, StatCard, TextArea, TextInput } from '@/components/ui';
import { SEED_TIPOS, uid, useStore, type Buyer, type Oferta } from '@/lib/store';

const STEPS = ['Dominio', 'Países e IAs', 'Ofertas', 'Buyer personas', 'Prompts', 'Costo', 'Competidores', 'Iniciar'];
const COUNTRIES = ['Argentina', 'Chile', 'Colombia', 'España', 'México', 'Perú', 'Uruguay', 'Estados Unidos'];
const IAS = ['ChatGPT', 'Gemini', 'Perplexity', 'Claude', 'AI Overview', 'AI Mode'];

type Draft = {
  name: string;
  domain: string;
  industry: string;
  description: string;
  countries: string[];
  ias: string[];
  ofertas: Oferta[];
  buyers: Buyer[];
  prompts: string[];
  competitors: { name: string; domain: string }[];
  frequency: 'Diaria' | 'Semanal' | 'Quincenal' | 'Mensual';
};

const BLANK: Draft = {
  name: '',
  domain: '',
  industry: '',
  description: '',
  countries: [],
  ias: ['ChatGPT'],
  ofertas: [],
  buyers: [],
  prompts: [],
  competitors: [],
  frequency: 'Semanal',
};

const RUNS_PER_MONTH = { Diaria: 30, Semanal: 4, Quincenal: 2, Mensual: 1 } as const;

function Toggle({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        on ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan' : 'border-line bg-surface2 text-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}

export default function Page() {
  const router = useRouter();
  const { addProject, setActiveProject, projects } = useStore();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(BLANK);
  const [saved, setSaved] = useState<string | null>(null);
  const [buf, setBuf] = useState({ oferta: '', precio: '', buyer: '', buyerDesc: '', prompt: '', comp: '', compDomain: '' });
  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const toggle = (key: 'countries' | 'ias', v: string) => patch({ [key]: d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v] } as Partial<Draft>);

  const queries = useMemo(
    () => d.prompts.length * Math.max(1, d.ias.length) * Math.max(1, d.countries.length) * RUNS_PER_MONTH[d.frequency],
    [d.prompts.length, d.ias.length, d.countries.length, d.frequency],
  );

  const valid = [
    d.name.trim() && d.domain.trim(),
    d.countries.length > 0 && d.ias.length > 0,
    true,
    true,
    d.prompts.length > 0,
    true,
    true,
    true,
  ][step];

  const suggest = () => {
    const base = d.name || 'la marca';
    const tipos = SEED_TIPOS.map((t) => t.name);
    const out: string[] = [];
    const ctx = d.industry ? ` en ${d.industry}` : '';
    out.push(`¿Qué es ${base} y para qué sirve${ctx}?`);
    out.push(`¿Cuáles son las mejores alternativas${ctx}? Recomendame un Top 3.`);
    out.push(`¿Qué opinan los usuarios de ${base}? ¿Es confiable?`);
    if (d.competitors[0]) out.push(`Comparativa: ${base} vs ${d.competitors[0].name}`);
    d.ofertas.forEach((o) => out.push(`¿Cuánto cuesta ${o.name} de ${base} y qué incluye?`));
    d.buyers.forEach((b) => out.push(`Soy ${b.name}: ¿qué solución${ctx} me recomendás?`));
    void tipos;
    patch({ prompts: Array.from(new Set([...d.prompts, ...out])) });
  };

  const finish = (status: 'borrador' | 'creado') => {
    const id = addProject(
      {
        name: d.name.trim(),
        domain: d.domain.trim(),
        countries: d.countries,
        ias: d.ias,
        prompts: d.prompts,
        competitors: d.competitors.map((c) => c.name),
        status,
      },
      {
        ofertas: d.ofertas,
        buyers: d.buyers,
        proyecto: { name: d.name, domain: d.domain, country: d.countries.join(', '), industry: d.industry, description: d.description, frequency: d.frequency },
        marcas: [
          { id: uid('marca'), name: d.name, domain: d.domain, kind: 'propia', aliases: '' },
          ...d.competitors.map((c) => ({ id: uid('marca'), name: c.name, domain: c.domain, kind: 'competidor' as const, aliases: '' })),
        ],
      },
    );
    setSaved(id);
  };

  if (saved) {
    return (
      <>
        <PageHeader eyebrow="Setup / Nuevo proyecto" title="Proyecto guardado" subtitle="Se guardó en este navegador como proyecto local." badge={<ConfigBadge />} />
        <Card className="max-w-xl">
          <div className="text-fg font-semibold mb-1">{d.name}</div>
          <p className="text-xs text-dim leading-relaxed mb-4">
            Aún no hay conexión con una marca de Cleexs para este proyecto, por lo que no se muestran métricas. Podés cargar y revisar su configuración (ofertas, buyer personas, marcas).
          </p>
          <div className="flex gap-2">
            <Btn
              onClick={() => {
                setActiveProject(saved);
                router.push('/proyecto');
              }}
            >
              Abrir proyecto
            </Btn>
            <GhostBtn onClick={() => { setSaved(null); setD(BLANK); setStep(0); }}>Crear otro</GhostBtn>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Setup / Nuevo proyecto"
        title="Configurar nuevo proyecto de visibilidad IA"
        subtitle="Asistente de 8 pasos: dominio, países e IAs, ofertas, buyer personas, prompts, costo, competidores e inicio."
        badge={<ConfigBadge label="Se guarda localmente" />}
      />

      <ol className="flex flex-wrap gap-2 mb-6">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => i <= step && setStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${
                i === step ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan font-medium' : i < step ? 'border-accent-teal/40 text-accent-teal' : 'border-line text-dim'
              }`}
            >
              <span className="w-4 h-4 rounded-full border border-current text-[10px] flex items-center justify-center">{i < step ? '✓' : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <Card>
          {step === 0 && (
            <>
              <CardTitle>Identidad y dominio</CardTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nombre del proyecto *"><TextInput value={d.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Mi marca" /></Field>
                <Field label="Dominio canónico *"><TextInput value={d.domain} onChange={(e) => patch({ domain: e.target.value })} placeholder="mimarca.com" /></Field>
                <div className="md:col-span-2"><Field label="Industria"><TextInput value={d.industry} onChange={(e) => patch({ industry: e.target.value })} placeholder="Software de facturación" /></Field></div>
                <div className="md:col-span-2"><Field label="Descripción"><TextArea value={d.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Qué hace la marca y a quién sirve" /></Field></div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <CardTitle>Países e IAs a monitorear</CardTitle>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Países *</div>
              <div className="flex flex-wrap gap-2 mb-6">{COUNTRIES.map((c) => <Toggle key={c} on={d.countries.includes(c)} onClick={() => toggle('countries', c)}>{c}</Toggle>)}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">IAs *</div>
              <div className="flex flex-wrap gap-2">{IAS.map((c) => <Toggle key={c} on={d.ias.includes(c)} onClick={() => toggle('ias', c)}>{c}</Toggle>)}</div>
              <p className="text-[11px] text-dim mt-3">Hoy Cleexs ejecuta un solo modelo por corrida; la selección queda como intención del proyecto.</p>
            </>
          )}

          {step === 2 && (
            <>
              <CardTitle>Ofertas (opcional)</CardTitle>
              <div className="flex gap-2 mb-4">
                <TextInput value={buf.oferta} onChange={(e) => setBuf({ ...buf, oferta: e.target.value })} placeholder="Nombre de la oferta" />
                <TextInput value={buf.precio} onChange={(e) => setBuf({ ...buf, precio: e.target.value })} placeholder="Precio" className="max-w-[160px]" />
                <Btn icon="add" onClick={() => { if (!buf.oferta.trim()) return; patch({ ofertas: [...d.ofertas, { id: uid('oferta'), name: buf.oferta.trim(), price: buf.precio, description: '', status: 'activa' }] }); setBuf({ ...buf, oferta: '', precio: '' }); }}>Añadir</Btn>
              </div>
              <Chips items={d.ofertas.map((o) => `${o.name}${o.price ? ` · ${o.price}` : ''}`)} onRemove={(i) => patch({ ofertas: d.ofertas.filter((_, j) => j !== i) })} empty="Sin ofertas. Podés saltar este paso." />
            </>
          )}

          {step === 3 && (
            <>
              <CardTitle>Buyer personas (opcional)</CardTitle>
              <div className="flex gap-2 mb-4">
                <TextInput value={buf.buyer} onChange={(e) => setBuf({ ...buf, buyer: e.target.value })} placeholder="Nombre (ej. Contadores independientes)" />
                <TextInput value={buf.buyerDesc} onChange={(e) => setBuf({ ...buf, buyerDesc: e.target.value })} placeholder="Descripción breve" />
                <Btn icon="add" onClick={() => { if (!buf.buyer.trim()) return; patch({ buyers: [...d.buyers, { id: uid('buyer'), name: buf.buyer.trim(), description: buf.buyerDesc, painPoints: '' }] }); setBuf({ ...buf, buyer: '', buyerDesc: '' }); }}>Añadir</Btn>
              </div>
              <Chips items={d.buyers.map((b) => b.name)} onRemove={(i) => patch({ buyers: d.buyers.filter((_, j) => j !== i) })} empty="Sin buyer personas. Podés saltar este paso." />
            </>
          )}

          {step === 4 && (
            <>
              <CardTitle right={<GhostBtn icon="sparkle" onClick={suggest}>Sugerir prompts</GhostBtn>}>Prompts a monitorear *</CardTitle>
              <div className="flex gap-2 mb-4">
                <TextInput value={buf.prompt} onChange={(e) => setBuf({ ...buf, prompt: e.target.value })} placeholder="¿Cuál es el mejor software para…?" onKeyDown={(e) => { if (e.key === 'Enter' && buf.prompt.trim()) { patch({ prompts: [...d.prompts, buf.prompt.trim()] }); setBuf({ ...buf, prompt: '' }); } }} />
                <Btn icon="add" onClick={() => { if (!buf.prompt.trim()) return; patch({ prompts: [...d.prompts, buf.prompt.trim()] }); setBuf({ ...buf, prompt: '' }); }}>Añadir</Btn>
              </div>
              <Chips items={d.prompts} onRemove={(i) => patch({ prompts: d.prompts.filter((_, j) => j !== i) })} empty="Agregá al menos un prompt o usá “Sugerir prompts” (plantillas editables, no generadas por Cleexs)." />
            </>
          )}

          {step === 5 && (
            <>
              <CardTitle>Estimación de consumo</CardTitle>
              <div className="max-w-xs mb-5">
                <Field label="Frecuencia">
                  <Select value={d.frequency} onChange={(e) => patch({ frequency: e.target.value as Draft['frequency'] })}>
                    {Object.keys(RUNS_PER_MONTH).map((f) => <option key={f}>{f}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                {[
                  ['Prompts', d.prompts.length],
                  ['IAs', Math.max(1, d.ias.length)],
                  ['Países', Math.max(1, d.countries.length)],
                  ['Corridas / mes', RUNS_PER_MONTH[d.frequency]],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl bg-surface2 border border-line py-3">
                    <div className="text-lg font-bold text-fg">{v}</div>
                    <div className="text-[11px] text-dim">{k}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted mt-4">
                Consultas estimadas por mes: <b className="text-accent-cyan">{queries}</b>. El costo en dinero depende del plan de Cleexs; esta app no calcula precios.
              </p>
            </>
          )}

          {step === 6 && (
            <>
              <CardTitle>Competidores</CardTitle>
              <div className="flex gap-2 mb-4">
                <TextInput value={buf.comp} onChange={(e) => setBuf({ ...buf, comp: e.target.value })} placeholder="Nombre" />
                <TextInput value={buf.compDomain} onChange={(e) => setBuf({ ...buf, compDomain: e.target.value })} placeholder="dominio.com" />
                <Btn icon="add" onClick={() => { if (!buf.comp.trim()) return; patch({ competitors: [...d.competitors, { name: buf.comp.trim(), domain: buf.compDomain.trim() }] }); setBuf({ ...buf, comp: '', compDomain: '' }); }}>Añadir</Btn>
              </div>
              <Chips items={d.competitors.map((c) => `${c.name}${c.domain ? ` · ${c.domain}` : ''}`)} onRemove={(i) => patch({ competitors: d.competitors.filter((_, j) => j !== i) })} empty="Sin competidores." />
            </>
          )}

          {step === 7 && (
            <>
              <CardTitle>Revisión final</CardTitle>
              <dl className="text-xs space-y-2">
                {[
                  ['Proyecto', `${d.name} · ${d.domain}`],
                  ['Países', d.countries.join(', ')],
                  ['IAs', d.ias.join(', ')],
                  ['Ofertas', d.ofertas.length],
                  ['Buyer personas', d.buyers.length],
                  ['Prompts', d.prompts.length],
                  ['Competidores', d.competitors.length],
                  ['Frecuencia', d.frequency],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between border-b border-line/70 pb-2">
                    <dt className="text-dim">{k}</dt>
                    <dd className="text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
              <Notice tone="amber">
                <span className="block mt-3">El proyecto se guardará localmente. El análisis real en Cleexs requiere registrar la marca en Cleexs: esta app todavía no inicia corridas por sí misma.</span>
              </Notice>
              <div className="flex gap-2">
                <Btn icon="check" onClick={() => finish('creado')}>Crear proyecto</Btn>
                <GhostBtn onClick={() => finish('borrador')}>Guardar borrador</GhostBtn>
              </div>
            </>
          )}

          <div className="flex justify-between mt-8 pt-4 border-t border-line">
            <GhostBtn disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Atrás</GhostBtn>
            {step < STEPS.length - 1 && (
              <Btn disabled={!valid} onClick={() => setStep((s) => s + 1)} icon="arrowRight">Continuar</Btn>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <StatCard label="Consultas estimadas / mes" value={queries} tone="cyan" sub="prompts × IAs × países × corridas" />
          <Card className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Proyectos locales</div>
            {projects.length === 0 ? (
              <p className="text-xs text-dim">Todavía no creaste ninguno.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span className="text-fg">{p.name}</span>
                    <Pill tone={p.status === 'creado' ? 'teal' : 'slate'}>{p.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Chips({ items, onRemove, empty }: { items: string[]; onRemove: (i: number) => void; empty: string }) {
  if (!items.length) return <p className="text-xs text-dim">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((t, i) => (
        <li key={`${t}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-surface2 border border-line px-3 py-2 text-xs text-fg">
          <span>{t}</span>
          <button type="button" onClick={() => onRemove(i)} className="text-dim hover:text-red-400" aria-label="Quitar">
            <Icon name="x" className="w-3.5 h-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
