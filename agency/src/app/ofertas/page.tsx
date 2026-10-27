'use client';

import Crud from '@/components/Crud';
import { Notice, Pill, StatCard } from '@/components/ui';
import { useStore, type Oferta } from '@/lib/store';

export default function Page() {
  const { config, updateConfig, snapshot } = useStore();
  const prompts = snapshot.data?.prompts ?? [];
  const used = (id: string) => prompts.filter((p) => config.promptTags[p.promptId]?.ofertaId === id).length;
  const tone = { activa: 'green', beta: 'amber', inactiva: 'slate' } as const;

  return (
    <Crud<Oferta>
      idPrefix="oferta"
      eyebrow="Registro comercial"
      title="Catálogo de ofertas"
      subtitle="Planes, productos o servicios del proyecto. Se usan como filtro: etiquetá cada prompt con una oferta desde la sección Prompts."
      items={config.ofertas}
      onChange={(ofertas) => updateConfig({ ofertas })}
      blank={{ name: '', price: '', description: '', status: 'activa' }}
      addLabel="Añadir oferta"
      emptyTitle="Todavía no hay ofertas"
      emptyBody="Creá la primera oferta para poder filtrar el dashboard por producto o plan."
      top={
        <>
          <Notice tone="cyan">Esta sección es configuración local del proyecto (se guarda en este navegador). Cleexs aún no mide visibilidad por oferta: el filtro depende de las etiquetas que asignes a los prompts.</Notice>
          <section className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Ofertas registradas" value={config.ofertas.length} tone="fg" />
            <StatCard label="Activas" value={config.ofertas.filter((o) => o.status === 'activa').length} tone="teal" />
            <StatCard label="Prompts etiquetados" value={prompts.filter((p) => config.promptTags[p.promptId]?.ofertaId).length} tone="cyan" sub={`de ${prompts.length} en la última corrida`} />
          </section>
        </>
      }
      fields={[
        { key: 'name', label: 'Nombre de la oferta', required: true, placeholder: 'Plan Pro' },
        { key: 'price', label: 'Precio', placeholder: 'USD 49 / mes' },
        { key: 'status', label: 'Estado', type: 'select', options: [{ value: 'activa', label: 'Activa' }, { value: 'beta', label: 'Beta' }, { value: 'inactiva', label: 'Inactiva' }] },
        { key: 'description', label: 'Descripción / propuesta de valor', type: 'textarea' },
      ]}
      columns={[
        { label: 'Oferta', render: (o) => <span className="text-fg font-medium">{o.name}</span> },
        { label: 'Precio', render: (o) => o.price || '—' },
        { label: 'Estado', render: (o) => <Pill tone={tone[o.status]}>{o.status}</Pill> },
        { label: 'Descripción', render: (o) => <span className="line-clamp-2 max-w-sm">{o.description || '—'}</span> },
        { label: 'Prompts', render: (o) => used(o.id) },
      ]}
    />
  );
}
