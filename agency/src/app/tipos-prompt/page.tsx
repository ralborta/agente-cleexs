'use client';

import Crud from '@/components/Crud';
import { Notice, StatCard } from '@/components/ui';
import { fmtPct, pct } from '@/lib/metrics';
import { useStore, type Tipo } from '@/lib/store';

const stem = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().slice(0, 7);

export default function Page() {
  const { config, updateConfig, snapshot } = useStore();
  const prompts = snapshot.data?.prompts ?? [];
  const stats = (name: string) => {
    const ps = prompts.filter((p) => p.type && stem(p.type) === stem(name));
    return { n: ps.length, vis: pct(ps.filter((p) => p.brandInTop3).length, ps.length) };
  };
  const known = new Set(config.tipos.map((t) => stem(t.name)));
  const extra = Array.from(new Set(prompts.map((p) => p.type).filter((t): t is string => !!t && !known.has(stem(t)))));

  return (
    <Crud<Tipo>
      idPrefix="tipo"
      eyebrow="Registro"
      title="Tipos de prompt"
      subtitle="Taxonomía de intención de las consultas. Los contadores de prompts y visibilidad vienen de la última corrida real en Cleexs."
      items={config.tipos}
      onChange={(tipos) => updateConfig({ tipos })}
      blank={{ name: '', description: '' }}
      addLabel="Crear tipo de prompt"
      emptyTitle="Sin tipos"
      emptyBody="Creá tipos para clasificar tus prompts."
      top={
        <>
          <Notice tone="cyan">
            La taxonomía es configuración local (semilla: Informativa, Recomendación, Percepción, Comparativa). Los prompts de Cleexs ya traen su tipo en el nombre
            {extra.length > 0 && <> — tipos detectados que no están en tu lista: <b>{extra.join(', ')}</b></>}.
          </Notice>
          <section className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Tipos configurados" value={config.tipos.length} tone="fg" />
            <StatCard label="Prompts clasificados" value={prompts.filter((p) => p.type).length} sub={`de ${prompts.length} en la última corrida`} />
          </section>
        </>
      }
      fields={[
        { key: 'name', label: 'Nombre', required: true },
        { key: 'description', label: 'Descripción', type: 'textarea' },
      ]}
      columns={[
        { label: 'Tipo', render: (t) => <span className="text-fg font-medium">{t.name}</span> },
        { label: 'Descripción', render: (t) => <span className="line-clamp-2 max-w-md">{t.description || '—'}</span> },
        { label: 'Prompts (Cleexs)', render: (t) => stats(t.name).n },
        { label: 'Visibilidad', render: (t) => <span className="text-fg font-semibold">{fmtPct(stats(t.name).vis)}</span> },
      ]}
    />
  );
}
