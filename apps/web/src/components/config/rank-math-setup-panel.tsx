'use client';

import { SettingsSection } from '@/components/config/settings-section';

export function RankMathSetupPanel() {
  return (
    <SettingsSection
      title="Rank Math SEO (SiteGround)"
      description="Pasos manuales en cleexs.net — Teo ya envía meta SEO cuando está configurado."
    >
      <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-200">
        <li>
          WP Admin → <strong>Plugins → Añadir nuevo</strong> → instalar <strong>Rank Math SEO</strong>{' '}
          → Activar → completar asistente.
        </li>
        <li>
          SiteGround <strong>Site Tools → File Manager</strong> →{' '}
          <code className="rounded bg-[#0b1220] px-1.5 py-0.5 text-xs">public_html/wp-content/</code>
          → crear carpeta <code className="rounded bg-[#0b1220] px-1.5 py-0.5 text-xs">mu-plugins</code>{' '}
          si no existe.
        </li>
        <li>
          Subir desde el repo:{' '}
          <code className="rounded bg-[#0b1220] px-1.5 py-0.5 text-xs">
            docs/wordpress/cleexs-teo-rankmath-rest.php
          </code>{' '}
          como{' '}
          <code className="rounded bg-[#0b1220] px-1.5 py-0.5 text-xs">
            mu-plugins/cleexs-teo-rankmath-rest.php
          </code>
        </li>
        <li>
          API Easypanel: <code className="rounded bg-[#0b1220] px-1.5 py-0.5 text-xs">WORDPRESS_SEO_PLUGIN=rankmath</code>{' '}
          (ya configurado) → redeploy api si cambiaste algo.
        </li>
        <li>
          Publicá o aprobá un artículo → editá el post en WP → panel Rank Math debe mostrar título,
          description y keyword.
        </li>
      </ol>
      <p className="mt-4 text-xs text-hub-muted">
        Guía completa: <code className="rounded bg-[#0b1220] px-1">docs/wordpress-setup-cleexs.md</code>
      </p>
    </SettingsSection>
  );
}
