'use client';

import GeoSteps from '@/components/GeoSteps';
import { Card, CardTitle, ComingSoon, DataGate, Notice, PageHeader, Pill, StatCard } from '@/components/ui';
import { fmtDate, fmtPct } from '@/lib/metrics';

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Mitigación GEO"
        title="Resultado de re-auditoría · 48 h"
        subtitle="Comparativa antes/después de la mitigación sobre los mismos prompts y condiciones de inferencia."
        badge={<Pill tone="slate">Paso 4 de 4</Pill>}
      />
      <GeoSteps />
      <DataGate>
        {(d) => {
          const cur = d.runs[d.runs.length - 1];
          const prev = d.runs.length > 1 ? d.runs[d.runs.length - 2] : null;
          const delta = cur?.visibilityPct != null && prev?.visibilityPct != null ? cur.visibilityPct - prev.visibilityPct : null;
          return (
            <>
              {!prev && <Notice tone="amber">Hay una sola corrida: todavía no existe un “después” contra el cual comparar.</Notice>}
              <section className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <StatCard label="Visibilidad · antes" value={fmtPct(prev?.visibilityPct)} tone="fg" sub={prev ? fmtDate(prev.createdAt, true) : 'Sin corrida previa'} />
                <StatCard label="Visibilidad · ahora" value={fmtPct(cur?.visibilityPct)} sub={cur ? fmtDate(cur.createdAt, true) : undefined} />
                <StatCard label="Variación" value={delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1).replace('.', ',')} pp`} tone={delta !== null && delta < 0 ? 'amber' : 'teal'} />
              </section>
              <Card>
                <CardTitle>Citas canónicas, polaridad y purga de caché</CardTitle>
                <ComingSoon what="Métricas de grounding y polaridad" />
              </Card>
            </>
          );
        }}
      </DataGate>
    </>
  );
}
