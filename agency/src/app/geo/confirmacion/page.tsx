'use client';

import GeoSteps from '@/components/GeoSteps';
import { Card, CardTitle, ComingSoon, PageHeader, Pill } from '@/components/ui';

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Mitigación GEO"
        title="Confirmación de monitorización"
        subtitle="Resumen del plan de mitigación aprobado y del calendario de verificaciones (48 h, día 7 y día 14)."
        badge={<Pill tone="slate">Paso 2 de 4</Pill>}
      />
      <GeoSteps />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {[
          { t: 'Check 48 h', d: 'Re-auditoría de los prompts afectados tras publicar el contenido canónico.' },
          { t: 'Check día 7', d: 'Verificación en comparadores y agregadores citados de forma secundaria.' },
          { t: 'Check día 14', d: 'Re-ejecución masiva de prompts para cerrar el caso.' },
        ].map((c) => (
          <Card key={c.t}>
            <CardTitle right={<Pill tone="slate">Sin programar</Pill>}>{c.t}</CardTitle>
            <p className="text-xs text-dim leading-relaxed">{c.d}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardTitle>Incidente en seguimiento</CardTitle>
        <ComingSoon what="Seguimiento de mitigaciones" />
      </Card>
    </>
  );
}
