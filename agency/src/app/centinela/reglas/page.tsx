'use client';

import Link from 'next/link';
import Crud from '@/components/Crud';
import { Notice, Pill } from '@/components/ui';
import { useStore, type Regla } from '@/lib/store';

export default function Page() {
  const { config, updateConfig } = useStore();
  const tone = { P0: 'red', P1: 'amber', P2: 'cyan', P3: 'slate' } as const;
  return (
    <Crud<Regla>
      idPrefix="regla"
      eyebrow="Protocolo Centinela"
      title="Configurar reglas de alerta"
      subtitle="Define umbrales de visibilidad, share of voice o posición. Las reglas se guardan en este proyecto."
      items={config.reglas}
      onChange={(reglas) => updateConfig({ reglas })}
      blank={{ name: '', severity: 'P2', metric: 'Visibilidad', condition: 'cae por debajo de', threshold: '', channel: '', description: '' }}
      addLabel="Nueva regla"
      emptyTitle="Sin reglas configuradas"
      emptyBody="Creá una regla, por ejemplo: Visibilidad cae por debajo de 30%."
      top={
        <Notice tone="amber">
          Borrador local: las reglas se guardan en este navegador y todavía no se evalúan automáticamente ni disparan notificaciones. Cuando Cleexs exponga alertas, se alimentará el <Link href="/centinela" className="underline">historial</Link>.
        </Notice>
      }
      fields={[
        { key: 'name', label: 'Nombre de la regla', required: true },
        { key: 'severity', label: 'Severidad', type: 'select', options: ['P0', 'P1', 'P2', 'P3'].map((v) => ({ value: v, label: v })) },
        { key: 'metric', label: 'Métrica', type: 'select', options: ['Visibilidad', 'Share of voice', 'Posición media'].map((v) => ({ value: v, label: v })) },
        { key: 'condition', label: 'Condición', type: 'select', options: ['cae por debajo de', 'sube por encima de'].map((v) => ({ value: v, label: v })) },
        { key: 'threshold', label: 'Umbral', placeholder: '30%' },
        { key: 'channel', label: 'Canal de aviso (referencia)', placeholder: 'Email / Slack' },
        { key: 'description', label: 'Descripción', type: 'textarea' },
      ]}
      columns={[
        { label: 'Regla', render: (r) => <span className="text-fg font-medium">{r.name}</span> },
        { label: 'Severidad', render: (r) => <Pill tone={tone[r.severity]}>{r.severity}</Pill> },
        { label: 'Condición', render: (r) => `${r.metric} ${r.condition} ${r.threshold || '—'}` },
        { label: 'Canal', render: (r) => r.channel || '—' },
      ]}
    />
  );
}
