'use client';

import Crud from '@/components/Crud';
import { Notice, Pill, StatCard } from '@/components/ui';
import { computeMentions, fmtPct, pct } from '@/lib/metrics';
import { useStore, type Marca } from '@/lib/store';

export default function Page() {
  const { config, updateConfig, snapshot, isDefaultProject } = useStore();
  const snap = isDefaultProject ? snapshot.data : null;
  const prompts = snap?.prompts ?? [];
  const mentions = snap ? computeMentions(prompts, snap.brand) : null;
  const total = prompts.length;

  const readonlyRows = snap && mentions ? (
    <>
      <tr className="bg-accent-cyan/5">
        <td className="py-3 pr-3"><span className="text-fg font-medium">{snap.brand.name}</span><div className="text-[11px] text-dim">{snap.brand.domain}</div></td>
        <td className="py-3 pr-3"><Pill tone="teal">Marca propia</Pill> <Pill tone="green">Cleexs</Pill></td>
        <td className="py-3 pr-3">{snap.brand.aliases.join(', ') || '—'}</td>
        <td className="py-3 pr-3 text-fg font-semibold">{fmtPct(pct(mentions.brand.appearances, total))}</td>
        <td className="py-3 text-right text-dim text-[11px]">solo lectura</td>
      </tr>
      {snap.brand.competitors.map((c) => {
        const m = mentions.others.find((o) => o.name === c.displayName);
        return (
          <tr key={c.id}>
            <td className="py-3 pr-3"><span className="text-fg font-medium">{c.displayName}</span><div className="text-[11px] text-dim">{c.domain}</div></td>
            <td className="py-3 pr-3"><Pill tone="purple">Competidor</Pill> <Pill tone="green">Cleexs</Pill></td>
            <td className="py-3 pr-3">—</td>
            <td className="py-3 pr-3 text-fg font-semibold">{fmtPct(pct(m?.appearances ?? 0, total))}</td>
            <td className="py-3 text-right text-dim text-[11px]">solo lectura</td>
          </tr>
        );
      })}
    </>
  ) : null;

  return (
    <Crud<Marca>
      idPrefix="marca"
      eyebrow="Registro · Entidades"
      title="Gestión de marcas y entidades"
      subtitle="Marca propia y competidores. Las filas de Cleexs vienen de la API (solo lectura); las que agregues acá son config local y todavía no se miden."
      items={config.marcas}
      onChange={(marcas) => updateConfig({ marcas })}
      blank={{ name: '', domain: '', kind: 'competidor', aliases: '' }}
      addLabel="Añadir marca o competidor"
      emptyTitle="Sin marcas"
      emptyBody="Agregá marcas para llevar tu propio registro."
      readonlyRows={readonlyRows}
      top={
        <>
          <Notice tone="amber">Las marcas locales no alimentan las métricas: para que Cleexs mida un competidor nuevo hay que registrarlo en Cleexs.</Notice>
          <section className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Entidades en Cleexs" value={snap ? 1 + snap.brand.competitors.length : '—'} tone="cyan" sub={snap ? `1 propia · ${snap.brand.competitors.length} competidores` : undefined} />
            <StatCard label="Entidades locales" value={config.marcas.length} tone="fg" />
          </section>
        </>
      }
      fields={[
        { key: 'name', label: 'Nombre', required: true },
        { key: 'domain', label: 'Dominio', placeholder: 'ejemplo.com' },
        { key: 'kind', label: 'Clasificación', type: 'select', options: [{ value: 'propia', label: 'Marca propia' }, { value: 'competidor', label: 'Competidor' }] },
        { key: 'aliases', label: 'Aliases (separados por coma)' },
      ]}
      columns={[
        { label: 'Marca / dominio', render: (m) => <><span className="text-fg font-medium">{m.name}</span><div className="text-[11px] text-dim">{m.domain}</div></> },
        { label: 'Clasificación', render: (m) => <><Pill tone={m.kind === 'propia' ? 'teal' : 'purple'}>{m.kind === 'propia' ? 'Marca propia' : 'Competidor'}</Pill> <Pill tone="amber">local</Pill></> },
        { label: 'Aliases', render: (m) => m.aliases || '—' },
        { label: 'Visibilidad', render: () => <span className="text-dim">sin medir</span> },
      ]}
    />
  );
}
