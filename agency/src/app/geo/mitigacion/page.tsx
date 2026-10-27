'use client';

import GeoSteps from '@/components/GeoSteps';
import { Card, CardTitle, DataGate, EmptyState, GhostBtn, Notice, PageHeader, Pill, Table } from '@/components/ui';
import { displayName } from '@/lib/metrics';

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Mitigación GEO"
        title="Flujo de mitigación"
        subtitle="Del incidente al plan de acción: identificá dónde la marca queda fuera del Top 3, inyectá contenido canónico y programá las re-auditorías."
        badge={<Pill tone="slate">Paso 1 de 4</Pill>}
      />
      <GeoSteps />
      <Notice tone="cyan">
        Los candidatos se calculan con datos reales de la última corrida (prompts donde la marca no entró al Top 3). Las acciones de mitigación y su ejecución automática llegarán con Cleexs.
      </Notice>
      <DataGate>
        {(d) => {
          const weak = d.prompts.filter((p) => !p.brandInTop3);
          return (
            <Card>
              <CardTitle hint="Prompts de la última corrida en los que la marca no apareció en el Top 3.">Prompts candidatos a mitigación</CardTitle>
              {weak.length === 0 ? (
                <EmptyState icon="check" title="Sin candidatos" body="La marca aparece en el Top 3 en todos los prompts analizados con los filtros actuales." />
              ) : (
                <Table head={['Tipo', 'Prompt', 'Quién ocupa el Top 3', { label: 'Acción', right: true }]}>
                  {weak.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 pr-3 whitespace-nowrap">{p.type ?? '—'}</td>
                      <td className="py-3 pr-3 text-fg max-w-lg"><span className="line-clamp-2">{p.text.split('\n')[1] || p.text}</span></td>
                      <td className="py-3 pr-3">{p.top3.map((e) => `#${e.position} ${displayName(e.name)}`).join(' · ')}</td>
                      <td className="py-3 text-right"><GhostBtn disabled title="Próximamente">Preparar playbook</GhostBtn></td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          );
        }}
      </DataGate>
    </>
  );
}
