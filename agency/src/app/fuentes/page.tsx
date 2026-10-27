'use client';

import Placeholder from '@/components/Placeholder';

export default function Page() {
  return (
    <Placeholder
      eyebrow="Monitoreo"
      title="Análisis de fuentes y citaciones"
      subtitle="Fuentes web, dominios y documentación que las IA consultan y citan para generar respuestas sobre tu categoría."
      stats={[
        { label: 'Presencia en fuentes citadas', hint: 'Porcentaje de citas que apuntan a dominios propios.' },
        { label: 'Dominios de autoridad' },
        { label: 'Tasa de atribución clickeable', hint: 'Respuestas donde la IA incluye hipervínculo.' },
        { label: 'Posición media de citación' },
      ]}
      sections={[
        { title: 'Distribución por tipología de fuente', head: ['Tipología', 'Citas', '% del total'], what: 'Tipologías de fuente' },
        { title: 'Dominios de mayor impacto', head: ['Dominio', 'Categoría', 'Frecuencia', 'LLMs que citan', 'Sentimiento'], what: 'Dominios citados' },
        { title: 'Todas las fuentes', head: ['URL / Título', 'Categoría', 'Frecuencia', 'LLMs que citan', 'Sentimiento'], what: 'Citas por fuente' },
      ]}
    />
  );
}
