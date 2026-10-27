'use client';

import { useState } from 'react';
import { Card, CardTitle, DataGate, EmptyState, LineChart, Notice, Pill, Table, Tabs, Icon } from '@/components/ui';
import { computeMentions, computeSoV, displayName, fmtDate, fmtPct, pct } from '@/lib/metrics';
import { useStore, type FilteredData } from '@/lib/store';
import type { PromptRow } from '@/lib/types';
import Link from 'next/link';

type Tab = 'llm' | 'buyer' | 'oferta' | 'tipo';

function Dashboard({ d }: { d: FilteredData }) {
  const { config } = useStore();
  const [tab, setTab] = useState<Tab>('llm');
  const { snapshot: snap, runs, latest, prompts } = d;
  const brandName = snap.brand.name;

  if (!latest) {
    return (
      <EmptyState
        icon="clock"
        title="Sin corridas para los filtros actuales"
        body="Probá ampliando el período o limpiando filtros. Si la marca nunca corrió un análisis en Cleexs, tampoco habrá datos."
      />
    );
  }

  const vis = latest.visibilityPct;
  const prev = runs.length > 1 ? runs[runs.length - 2].visibilityPct : null;
  const delta = vis !== null && prev !== null ? vis - prev : null;
  const mentions = computeMentions(prompts, snap.brand);
  const sov = computeSoV(mentions, null);
  const sovMap = new Map(sov.map((s) => [s.key, s.sov]));

  // Tabla de competidores
  const total = prompts.length;
  const directos = mentions.others.filter((o) => o.kind === 'directo');
  const emergentes = mentions.others.filter((o) => o.kind === 'emergente');
  const rows = [
    {
      key: '__brand__',
      name: brandName,
      kind: 'objetivo' as const,
      vis: pct(mentions.brand.appearances, total),
      sov: sovMap.get('__brand__') ?? null,
      pos: mentions.brand.avgPosition,
    },
    ...[...directos, ...emergentes].map((o) => ({
      key: o.key,
      name: o.name,
      kind: o.kind,
      vis: pct(o.appearances, total),
      sov: sovMap.get(o.key) ?? null,
      pos: o.avgPosition,
    })),
  ];
  const kindTone = { objetivo: 'teal', directo: 'purple', emergente: 'amber' } as const;
  const kindLabel = { objetivo: 'Objetivo', directo: 'Directo', emergente: 'Emergente' } as const;

  // Desglose
  const group = (keyFn: (p: PromptRow) => string | null) => {
    const m = new Map<string, { n: number; hit: number }>();
    for (const p of prompts) {
      const k = keyFn(p);
      if (!k) continue;
      const r = m.get(k) ?? { n: 0, hit: 0 };
      r.n += 1;
      if (p.brandInTop3) r.hit += 1;
      m.set(k, r);
    }
    return [...m.entries()].map(([label, r]) => ({ label, responses: r.n, mentions: r.hit, vis: pct(r.hit, r.n) }));
  };
  const labelOfModel = (m: string | null) => snap.llms.find((l) => l.model === m)?.label ?? m ?? 'Desconocido';
  const llmRows = (() => {
    const m = new Map<string, { n: number; hit: number }>();
    for (const r of runs) {
      const k = labelOfModel(r.model);
      const x = m.get(k) ?? { n: 0, hit: 0 };
      x.n += r.promptsAnalyzed;
      x.hit += r.brandInTop3;
      m.set(k, x);
    }
    return [...m.entries()].map(([label, r]) => ({ label, responses: r.n, mentions: r.hit, vis: pct(r.hit, r.n) }));
  })();
  const buyerRows = group((p) => {
    const id = config.promptTags[p.promptId]?.buyerId;
    return config.buyers.find((b) => b.id === id)?.name ?? null;
  });
  const ofertaRows = group((p) => {
    const id = config.promptTags[p.promptId]?.ofertaId;
    return config.ofertas.find((o) => o.id === id)?.name ?? null;
  });
  const tipoRows = group((p) => p.type);
  const weak = prompts.filter((p) => !p.brandInTop3).slice(0, 10);

  const breakdown = { llm: llmRows, buyer: buyerRows, oferta: ofertaRows, tipo: tipoRows }[tab];
  const headLabel = { llm: 'LLMs', buyer: 'Buyer persona', oferta: 'Oferta', tipo: 'Tipo de prompt' }[tab];
  const emptyMsg = {
    llm: 'Sin información de modelos en esta corrida.',
    buyer: 'No hay prompts etiquetados con buyer persona. Etiquetalos en Prompts (config local).',
    oferta: 'No hay prompts etiquetados con una oferta. Etiquetalos en Prompts (config local).',
    tipo: 'Sin tipos de prompt detectados.',
  }[tab];

  return (
    <div className="space-y-6">
      {snap.warnings.length > 0 && <Notice>{snap.warnings.join(' · ')}</Notice>}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="flex flex-col justify-between">
          <div>
            <CardTitle hint="% de prompts donde la marca aparece en el Top 3 de la respuesta de la IA.">Visibilidad</CardTitle>
            <div className="flex items-baseline gap-3 -mt-2">
              <span className="text-4xl font-extrabold text-accent-cyan tracking-tight glow-text">{fmtPct(vis)}</span>
              {delta !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    delta >= 0 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10'
                  }`}
                >
                  <Icon name="up" className={`w-3 h-3 ${delta < 0 ? 'rotate-90' : ''}`} strokeWidth={2.5} />
                  {fmtPct(Math.abs(delta))}
                </span>
              )}
            </div>
            <p className="text-[11px] text-dim mt-1">
              {latest.brandInTop3} de {latest.promptsAnalyzed} prompts con {brandName} en Top 3 · corrida {fmtDate(latest.createdAt, true)}
            </p>
          </div>
          <div className="mt-4">
            <LineChart
              series={[{ name: 'Visibilidad', color: '#38bdf8', values: runs.map((r) => r.visibilityPct) }]}
              labels={runs.map((r) => fmtDate(r.createdAt))}
              yMax={100}
            />
            {runs.length === 1 && (
              <p className="text-[11px] text-dim mt-2">Solo hay una corrida registrada: la evolución aparecerá a medida que Cleexs ejecute nuevas corridas.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle hint="Porcentaje de citas/enlaces a fuentes propias dentro de las respuestas de la IA.">Presencia en fuentes</CardTitle>
          <EmptyState icon="link" title="Sin datos de citas aún" body="Cleexs todavía no registra las fuentes citadas por cada IA. Cuando el backend las exponga, verás aquí la presencia por dominio." />
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardTitle hint="Objetivo = tu marca. Directos = competidores registrados en Cleexs. Emergentes = marcas que aparecen en el Top 3 sin estar registradas.">
            Competidores principales
          </CardTitle>
          <Table head={['Marca', 'Tipo', 'Visibilidad', 'Share of voice', { label: 'Pos. media', right: true }]}>
            {rows.map((r) => (
              <tr key={r.key} className={r.kind === 'objetivo' ? 'bg-accent-cyan/5' : ''}>
                <td className="py-2.5 pr-3 text-fg font-medium">{r.name}</td>
                <td className="py-2.5 pr-3">
                  <Pill tone={kindTone[r.kind]}>{kindLabel[r.kind]}</Pill>
                </td>
                <td className="py-2.5 pr-3 text-fg font-semibold">{fmtPct(r.vis)}</td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-24 h-1.5 bg-line rounded-full overflow-hidden">
                      <div className="bg-accent-cyan h-full rounded-full" style={{ width: `${Math.min(100, r.sov ?? 0)}%` }} />
                    </div>
                    <span className="text-muted text-[11px]">{fmtPct(r.sov)}</span>
                  </div>
                </td>
                <td className="py-2.5 text-right text-muted">{r.pos ?? '—'}</td>
              </tr>
            ))}
          </Table>
          {emergentes.length === 0 && (
            <p className="text-[11px] text-dim mt-3">No se detectaron competidores emergentes en el Top 3 de esta corrida.</p>
          )}
        </Card>

        <Card>
          <CardTitle hint="Mismo cálculo de visibilidad, abierto por dimensión.">Desglose de {brandName}</CardTitle>
          <div className="mb-5">
            <Tabs<Tab>
              tabs={[
                { id: 'llm', label: 'LLMs' },
                { id: 'buyer', label: 'Buyer persona' },
                { id: 'oferta', label: 'Ofertas' },
                { id: 'tipo', label: 'Tipo de prompts' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </div>
          {breakdown.length === 0 ? (
            <EmptyState title="Sin datos" body={emptyMsg} />
          ) : (
            <Table head={[headLabel, { label: 'Respuestas', right: true }, { label: 'Menciones', right: true }, { label: 'Visibilidad', right: true }]}>
              {breakdown.map((r) => (
                <tr key={r.label}>
                  <td className="py-3 pr-3 text-fg font-medium">{r.label}</td>
                  <td className="py-3 pr-3 text-right">{r.responses}</td>
                  <td className="py-3 pr-3 text-right">{r.mentions}</td>
                  <td className="py-3 text-right text-fg font-semibold">{fmtPct(r.vis)}</td>
                </tr>
              ))}
            </Table>
          )}
          {tab === 'llm' && snap.llms.length === 1 && (
            <p className="text-[11px] text-dim mt-3">Cleexs corre hoy un solo modelo ({snap.llms[0].model}); otras IAs aparecerán cuando se ejecuten corridas con ellas.</p>
          )}
        </Card>
      </section>

      {weak.length > 0 && (
        <Card>
          <CardTitle hint="Prompts de la última corrida donde la marca no entró al Top 3.">Prompts débiles</CardTitle>
          <Table head={['Tipo', 'Prompt', 'Top 3 de la IA']}>
            {weak.map((w) => (
              <tr key={w.id}>
                <td className="py-2.5 pr-3 whitespace-nowrap">{w.type ?? '—'}</td>
                <td className="py-2.5 pr-3 text-fg max-w-xl"><span className="line-clamp-2">{w.text}</span></td>
                <td className="py-2.5 text-muted">{w.top3.map((e) => displayName(e.name)).join(' · ') || '—'}</td>
              </tr>
            ))}
          </Table>
          <div className="mt-3 text-xs">
            <Link href="/prompts" className="text-accent-cyan hover:underline">Ver todos los prompts →</Link>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function Page() {
  return <DataGate>{(d) => <Dashboard d={d} />}</DataGate>;
}
