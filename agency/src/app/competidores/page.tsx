'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card, CardTitle, DataGate, EmptyState, GhostBtn, LineChart, PageHeader, Pill, StatCard, Table, Tabs, TextInput, Icon } from '@/components/ui';
import { computeMentions, computeSoV, displayName, fmtDate, fmtPct, pct } from '@/lib/metrics';
import type { FilteredData } from '@/lib/store';

type KindFilter = 'todos' | 'directo' | 'emergente' | 'objetivo';
const COLORS = ['#a855f7', '#2dd4bf', '#eab308', '#f472b6', '#94a3b8'];

function Competidores({ d }: { d: FilteredData }) {
  const { snapshot: snap, runs, latest, prompts } = d;
  const [kind, setKind] = useState<KindFilter>('todos');
  const [q, setQ] = useState('');
  const [excluded, setExcluded] = useState<string[]>([]);

  const mentions = useMemo(() => computeMentions(prompts, snap.brand), [prompts, snap.brand]);
  const selectedKeys = useMemo(() => mentions.others.map((o) => o.key).filter((k) => !excluded.includes(k)), [mentions, excluded]);
  const sov = useMemo(() => computeSoV(mentions, selectedKeys), [mentions, selectedKeys]);
  const sovMap = new Map(sov.map((s) => [s.key, s.sov]));

  if (!latest) return <EmptyState icon="clock" title="Sin corridas para los filtros actuales" body="Ampliá el período o limpiá los filtros." />;

  const total = prompts.length;
  const brandVis = pct(mentions.brand.appearances, total);
  const ranked = [...mentions.others].sort((a, b) => b.appearances - a.appearances);
  const second = ranked[0];
  const secondVis = second ? pct(second.appearances, total) : null;
  const gap = brandVis !== null && secondVis !== null ? brandVis - secondVis : null;
  const compApps = mentions.others.reduce((s, o) => s + o.appearances, 0);
  const avgBrandsPerPrompt = total ? (mentions.brand.appearances + compApps) / total : null;
  const emptyTop3 = prompts.filter((p) => !p.top3.some((e) => e.type !== 'brand')).length;

  // Serie: marca + top 4 competidores por apariciones
  const topComp = ranked.filter((o) => o.appearances > 0).slice(0, 4);
  const series = [
    { name: snap.brand.name, color: '#38bdf8', values: runs.map((r) => r.visibilityPct) },
    ...topComp.map((c, i) => ({
      name: c.name,
      color: COLORS[i % COLORS.length],
      values: runs.map((r) => (r.promptsAnalyzed ? pct(r.appearances[c.key] ?? 0, r.promptsAnalyzed) : null)),
    })),
  ];

  const rows = [
    { key: '__brand__', name: snap.brand.name, domain: snap.brand.domain, kind: 'objetivo' as const, appearances: mentions.brand.appearances, pos: mentions.brand.avgPosition },
    ...mentions.others.map((o) => ({ key: o.key, name: o.name, domain: o.domain, kind: o.kind, appearances: o.appearances, pos: o.avgPosition })),
  ];
  const filtered = rows.filter((r) => (kind === 'todos' || r.kind === kind) && (!q || (r.name + (r.domain ?? '')).toLowerCase().includes(q.toLowerCase())));
  const count = (k: KindFilter) => (k === 'todos' ? rows.length : rows.filter((r) => r.kind === k).length);
  const kindTone = { objetivo: 'teal', directo: 'purple', emergente: 'amber' } as const;
  const kindLabel = { objetivo: 'Objetivo', directo: 'Directo', emergente: 'Emergente' } as const;

  // Insights derivados de los datos reales
  const lostPrompts = prompts.filter((p) => !p.brandInTop3);

  return (
    <>
      <PageHeader
        eyebrow="Monitoreo"
        title="Análisis de competidores"
        badge={<Pill tone="green">En vivo · {runs.length} {runs.length === 1 ? 'corrida' : 'corridas'}</Pill>}
        subtitle="Visibilidad y cuota de voz de tu marca frente a los competidores, calculadas con el Top 3 de cada respuesta de IA."
        actions={
          <Link href="/marcas">
            <GhostBtn icon="add">Añadir competidor</GhostBtn>
          </Link>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label={`${snap.brand.name} (propio)`} value={fmtPct(brandVis)} tone="cyan" sub={`${mentions.brand.appearances} apariciones en ${total} prompts`} />
        <StatCard
          label={second ? `Brecha con el 2º (${second.name})` : 'Brecha con el 2º'}
          value={gap === null ? '—' : `${gap >= 0 ? '+' : ''}${gap.toFixed(1).replace('.', ',')} pp`}
          tone="teal"
          sub={second ? `${second.name}: ${fmtPct(secondVis)}` : 'Sin competidores con apariciones'}
        />
        <StatCard label="Menciones de competencia" value={compApps} tone="purple" sub="Apariciones en Top 3 de competidores" />
        <StatCard label="Marcas por prompt" value={avgBrandsPerPrompt === null ? '—' : avgBrandsPerPrompt.toFixed(1).replace('.', ',')} tone="amber" sub="Promedio de entradas del Top 3" />
      </section>

      <Card className="mb-6">
        <CardTitle hint="Porcentaje de prompts donde cada marca aparece en el Top 3. Un punto por corrida.">
          Evolución de visibilidad: {snap.brand.name} vs competidores
        </CardTitle>
        <div className="flex flex-wrap gap-4 mb-4">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-fg">{s.name}</span>
              <span className="text-muted">{fmtPct(s.values[s.values.length - 1] ?? null)}</span>
            </div>
          ))}
        </div>
        <LineChart series={series} labels={runs.map((r) => fmtDate(r.createdAt))} yMax={100} height={180} />
        {runs.length === 1 && <p className="text-[11px] text-dim mt-2">Una sola corrida registrada: la línea temporal se completa con nuevas corridas.</p>}
      </Card>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Tabs<KindFilter>
            tabs={(['todos', 'directo', 'emergente', 'objetivo'] as const).map((k) => ({
              id: k,
              label: `${k === 'todos' ? 'Todos' : k === 'directo' ? 'Directos' : k === 'emergente' ? 'Emergentes' : 'Objetivo'} (${count(k)})`,
            }))}
            value={kind}
            onChange={setKind}
          />
          <div className="relative w-64">
            <Icon name="search" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <TextInput className="pl-8" placeholder="Buscar competidor..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Table
          head={[
            { label: 'SoV' },
            'Marca',
            'Tipo',
            'Visibilidad',
            'Share of voice',
            { label: 'Apariciones Top 3', right: true },
            { label: 'Pos. media', right: true },
          ]}
        >
          {filtered.map((r) => {
            const isBrand = r.key === '__brand__';
            const on = isBrand || !excluded.includes(r.key);
            return (
              <tr key={r.key} className={isBrand ? 'bg-accent-cyan/5' : ''}>
                <td className="py-2.5 pr-3">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={isBrand}
                    title="Incluir en el cálculo de Share of voice"
                    onChange={() => setExcluded((x) => (x.includes(r.key) ? x.filter((k) => k !== r.key) : [...x, r.key]))}
                  />
                </td>
                <td className="py-2.5 pr-3">
                  <div className="text-fg font-medium">{r.name}</div>
                  {r.domain && <div className="text-[11px] text-dim">{r.domain}</div>}
                </td>
                <td className="py-2.5 pr-3"><Pill tone={kindTone[r.kind]}>{kindLabel[r.kind]}</Pill></td>
                <td className="py-2.5 pr-3 text-fg font-semibold">{fmtPct(pct(r.appearances, total))}</td>
                <td className="py-2.5 pr-3">
                  {on ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-24 h-1.5 bg-line rounded-full overflow-hidden">
                        <div className="bg-accent-cyan h-full rounded-full" style={{ width: `${Math.min(100, sovMap.get(r.key) ?? 0)}%` }} />
                      </div>
                      <span className="text-muted text-[11px]">{fmtPct(sovMap.get(r.key) ?? null)}</span>
                    </div>
                  ) : (
                    <span className="text-dim text-[11px]">excluido</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-right">{r.appearances}</td>
                <td className="py-2.5 text-right">{r.pos ?? '—'}</td>
              </tr>
            );
          })}
        </Table>
        <p className="text-[11px] text-dim mt-3">
          Share of voice = apariciones de la marca sobre el total de apariciones entre {snap.brand.name} y los competidores marcados. Es una métrica distinta de Visibilidad.
        </p>
      </Card>

      <Card>
        <CardTitle hint="Lecturas derivadas directamente del Top 3 de la última corrida.">Matriz de amenazas y oportunidades</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-accent-amber/30 bg-accent-amber/5 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-accent-amber mb-1.5">Competidor dominante</div>
            <p className="text-xs text-fg leading-relaxed">
              {second && second.appearances > 0
                ? `${second.name} aparece en el Top 3 de ${second.appearances} de ${total} prompts (posición media ${second.avgPosition ?? '—'}).`
                : 'Ningún competidor aparece en el Top 3 de esta corrida.'}
            </p>
          </div>
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-red-400 mb-1.5">Prompts perdidos</div>
            <p className="text-xs text-fg leading-relaxed">
              {lostPrompts.length
                ? `${snap.brand.name} queda fuera del Top 3 en ${lostPrompts.length} de ${total} prompts. Ocupan el podio: ${Array.from(new Set(lostPrompts.flatMap((p) => p.top3.map((e) => displayName(e.name))))).slice(0, 4).join(', ')}.`
                : 'La marca aparece en el Top 3 en todos los prompts analizados.'}
            </p>
          </div>
          <div className="rounded-xl border border-accent-teal/30 bg-accent-teal/5 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-accent-teal mb-1.5">Espacio libre</div>
            <p className="text-xs text-fg leading-relaxed">
              {emptyTop3 > 0
                ? `En ${emptyTop3} prompts no aparece ningún competidor en el Top 3.`
                : 'En todos los prompts hay al menos un competidor en el Top 3.'}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-dim mt-4">Sentimiento y tendencias de citas por competidor: próximamente con datos Cleexs.</p>
      </Card>
    </>
  );
}

export default function Page() {
  return <DataGate>{(d) => <Competidores d={d} />}</DataGate>;
}
