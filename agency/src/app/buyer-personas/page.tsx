'use client';

import Crud from '@/components/Crud';
import { Notice, StatCard } from '@/components/ui';
import { useStore, type Buyer } from '@/lib/store';

export default function Page() {
  const { config, updateConfig, snapshot } = useStore();
  const prompts = snapshot.data?.prompts ?? [];
  const used = (id: string) => prompts.filter((p) => config.promptTags[p.promptId]?.buyerId === id).length;

  return (
    <Crud<Buyer>
      idPrefix="buyer"
      eyebrow="Registro semántico"
      title="Segmentación de buyer personas"
      subtitle="Perfiles objetivo del proyecto y sus dolores clave. Etiquetá prompts con un buyer persona para filtrar métricas."
      items={config.buyers}
      onChange={(buyers) => updateConfig({ buyers })}
      blank={{ name: '', description: '', painPoints: '' }}
      addLabel="Crear buyer persona"
      emptyTitle="Todavía no hay buyer personas"
      emptyBody="Cleexs aún no segmenta respuestas por buyer persona. Definí los tuyos y asignalos a los prompts."
      top={
        <>
          <Notice tone="cyan">Configuración local del proyecto. La visibilidad por buyer persona se calcula a partir de las etiquetas que asignes a cada prompt; no viene de un modelo de segmentación de Cleexs.</Notice>
          <section className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Segmentos" value={config.buyers.length} tone="fg" />
            <StatCard label="Prompts con buyer" value={prompts.filter((p) => config.promptTags[p.promptId]?.buyerId).length} sub={`de ${prompts.length} en la última corrida`} />
          </section>
        </>
      }
      fields={[
        { key: 'name', label: 'Nombre', required: true, placeholder: 'Gerente de operaciones' },
        { key: 'description', label: 'Descripción', type: 'textarea', placeholder: 'Quién es, tamaño de empresa, rol…' },
        { key: 'painPoints', label: 'Pain points clave', type: 'textarea', placeholder: 'Qué problemas busca resolver' },
      ]}
      columns={[
        { label: 'Buyer persona', render: (b) => <span className="text-fg font-medium">{b.name}</span> },
        { label: 'Descripción', render: (b) => <span className="line-clamp-3 max-w-xs">{b.description || '—'}</span> },
        { label: 'Pain points', render: (b) => <span className="line-clamp-3 max-w-sm">{b.painPoints || '—'}</span> },
        { label: 'Prompts', render: (b) => used(b.id) },
      ]}
    />
  );
}
