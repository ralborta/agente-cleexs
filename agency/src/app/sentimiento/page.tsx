'use client';

import Placeholder from '@/components/Placeholder';

export default function Page() {
  return (
    <Placeholder
      eyebrow="Monitoreo"
      title="Análisis de sentimiento y percepción de marca"
      subtitle="Polaridad, drivers de percepción y reputación de la marca frente a competidores en las respuestas de IA."
      stats={[
        { label: 'Índice neto de sentimiento (NSI)' },
        { label: 'Marca vs competencia' },
        { label: 'Riesgo reputacional' },
        { label: 'Atributo estrella' },
      ]}
      sections={[
        { title: 'Evolución temporal del sentimiento', head: ['Fecha', 'Positivo', 'Neutro', 'Negativo'], what: 'Sentimiento por período' },
        { title: 'Percepción por ejes temáticos', head: ['Eje', '% positivo', '% neutro', '% negativo'], what: 'Percepción por atributo' },
      ]}
    />
  );
}
