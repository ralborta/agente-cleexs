'use client';

import GeoSteps from '@/components/GeoSteps';
import { Card, CardTitle, ComingSoon, DataGate, Notice, PageHeader, Pill, StatCard } from '@/components/ui';
import { fmtDate, fmtPct } from '@/lib/metrics';

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Mitigación GEO"
        title="Re-auditoría masiva · día 14"
        subtitle="Re-ejecución de todos los prompts para sellar el caso y comparar contra la línea base previa a la mitigación."
        badge={<Pill tone="slate">Paso 3 de 4</Pill>}
      />
      <GeoSteps />
      <DataGate>
        {(d) => {
          const base = d.runs[d.runs.length - 1];
          return (
            <>
              <Notice tone="cyan">Una re-auditoría es una nueva corrida de Cleexs. Esta pantalla toma como línea base la última corrida disponible y la compara cuando exista una posterior.</Notice>
              <section className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <StatCard label="Línea base · Visibilidad" value={fmtPct(base?.visibilityPct)} sub={base ? `Corrida ${fmtDate(base.createdAt, true)}` : 'Sin corridas'} />
                <StatCard label="Prompts a re-auditar" value={base?.promptsAnalyzed ?? '—'} tone="fg" />
                <StatCard label="Corridas posteriores" value={Math.max(0, d.runs.length - 1)} tone="amber" sub="Necesarias para comparar" />
              </section>
              <Card>
                <CardTitle>Veredicto de la re-auditoría</CardTitle>
                <ComingSoon what="Comparativa pre/post mitigación" />
              </Card>
            </>
          );
        }}
      </DataGate>
    </>
  );
}
