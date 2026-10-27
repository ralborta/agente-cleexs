'use client';

import Link from 'next/link';
import Placeholder from '@/components/Placeholder';
import { GhostBtn } from '@/components/ui';

export default function Page() {
  return (
    <Placeholder
      eyebrow="Protocolo Centinela"
      title="Historial de alertas"
      subtitle="Bitácora de anomalías detectadas en las respuestas de IA: alucinaciones, caídas de visibilidad y deriva de polaridad."
      actions={
        <Link href="/centinela/reglas">
          <GhostBtn icon="sliders">Configurar reglas</GhostBtn>
        </Link>
      }
      stats={[
        { label: 'Alertas disparadas' },
        { label: 'Alucinaciones neutralizadas' },
        { label: 'Derivas de polaridad' },
        { label: 'Tiempo medio de resolución' },
      ]}
      sections={[
        {
          title: 'Bitácora de incidentes',
          head: ['Incidente y fecha', 'Severidad y regla', 'Motor IA', 'Anomalía detectada', 'Acción ejecutada', 'Estado'],
          what: 'Alertas Centinela',
        },
      ]}
    />
  );
}
