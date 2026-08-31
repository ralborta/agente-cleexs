'use client';

import { useWorkspaceSlug } from '@/lib/workspace';
import { useCallback, useEffect, useState } from 'react';
import { Eye, Palette } from 'lucide-react';
import {
  FieldLabel,
  SettingsSection,
  buttonSecondaryClassName,
  inputClassName,
} from '@/components/config/settings-section';
import {
  fetchBrandPreview,
  fetchCtaAbStats,
  type BrandKit,
  type BrandTemplateId,
} from '@/lib/api-client';

type Props = {
  branding: BrandKit;
  brandTemplates: Array<{ id: BrandTemplateId; label: string }>;
  onChange: (next: BrandKit) => void;
  /** Incrementar tras guardar para refrescar preview desde API. */
  previewVersion?: number;
};

export function BrandKitPanel({
  branding,
  brandTemplates,
  onChange,
  previewVersion = 0,
}: Props) {
  const workspace = useWorkspaceSlug();
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [abStats, setAbStats] = useState<{
    byVariant: {
      A: { click: number; submit: number; total: number };
      B: { click: number; submit: number; total: number };
    };
    winner: 'A' | 'B' | null;
    total: number;
    days: number;
  } | null>(null);

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const res = await fetchBrandPreview(workspace);
      setPreviewHtml(res.html);
    } catch {
      setPreviewHtml(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  const loadAbStats = useCallback(async () => {
    try {
      const res = await fetchCtaAbStats(workspace, 30);
      setAbStats(res);
    } catch {
      setAbStats(null);
    }
  }, [workspace]);

  useEffect(() => {
    loadPreview();
    loadAbStats();
  }, [previewVersion, loadAbStats]);

  function patch(partial: Partial<BrandKit>) {
    onChange({ ...branding, ...partial });
  }

  function patchCta(partial: NonNullable<BrandKit['cta']>) {
    onChange({ ...branding, cta: { ...branding.cta, ...partial } });
  }

  function patchCtaB(partial: NonNullable<BrandKit['ctaB']>) {
    onChange({ ...branding, ctaB: { ...branding.ctaB, ...partial }, ctaAbEnabled: true });
  }

  return (
    <>
      <SettingsSection
        title="Marca del contenido"
        description="Colores, CTA y firma que Teo usa al publicar artículos en WordPress."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <FieldLabel hint="Nombre comercial que aparece en meta, CTA y firma.">
                Marca / cliente
              </FieldLabel>
              <input
                value={branding.brandName ?? ''}
                onChange={(e) => patch({ brandName: e.target.value })}
                className={inputClassName}
                placeholder="Ej. Acme Corp"
              />
            </div>

            <div>
              <FieldLabel hint="Editorial, minimal o corporate (muestra logo arriba).">
                Plantilla
              </FieldLabel>
              <select
                value={branding.templateId ?? 'default'}
                onChange={(e) => patch({ templateId: e.target.value as BrandTemplateId })}
                className={inputClassName}
              >
                {brandTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Color primario</FieldLabel>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.primaryColor ?? '#2563EB'}
                    onChange={(e) => patch({ primaryColor: e.target.value })}
                    className="h-11 w-14 cursor-pointer rounded-lg border border-hub-border bg-[#0b1220]"
                  />
                  <input
                    value={branding.primaryColor ?? '#2563EB'}
                    onChange={(e) => patch({ primaryColor: e.target.value })}
                    className={inputClassName}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Color secundario</FieldLabel>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.secondaryColor ?? '#1D4ED8'}
                    onChange={(e) => patch({ secondaryColor: e.target.value })}
                    className="h-11 w-14 cursor-pointer rounded-lg border border-hub-border bg-[#0b1220]"
                  />
                  <input
                    value={branding.secondaryColor ?? '#1D4ED8'}
                    onChange={(e) => patch({ secondaryColor: e.target.value })}
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>

            <div>
              <FieldLabel hint="Solo se muestra con plantilla Corporate.">
                URL del logo
              </FieldLabel>
              <input
                value={branding.logoUrl ?? ''}
                onChange={(e) => patch({ logoUrl: e.target.value })}
                className={inputClassName}
                placeholder="https://…/logo.svg"
              />
            </div>

            <div>
              <FieldLabel hint="Foto circular del autor en el hero editorial. Vacío: Teo usa la foto por defecto.">
                URL foto del autor
              </FieldLabel>
              <input
                value={branding.authorAvatarUrl ?? ''}
                onChange={(e) => patch({ authorAvatarUrl: e.target.value })}
                className={inputClassName}
                placeholder="https://agents.cleexs.net/branding/teo.jpg"
              />
            </div>

            <div>
              <FieldLabel hint="Podés usar {brandName} como placeholder.">
                Firma del artículo
              </FieldLabel>
              <input
                value={branding.authorLine ?? ''}
                onChange={(e) => patch({ authorLine: e.target.value })}
                className={inputClassName}
                placeholder="Por el equipo de {brandName}"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-hub-border/70 bg-[#0b1220]/40 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-white">
              <Palette className="h-4 w-4 text-cleexs-blue" />
              Bloque CTA
            </p>
            <div>
              <FieldLabel>Título del CTA</FieldLabel>
              <input
                value={branding.cta?.headline ?? ''}
                onChange={(e) => patchCta({ headline: e.target.value })}
                className={inputClassName}
              />
            </div>
            <div>
              <FieldLabel>Texto de apoyo</FieldLabel>
              <textarea
                value={branding.cta?.body ?? ''}
                onChange={(e) => patchCta({ body: e.target.value })}
                rows={2}
                className={`${inputClassName} resize-y`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Botón</FieldLabel>
                <input
                  value={branding.cta?.label ?? ''}
                  onChange={(e) => patchCta({ label: e.target.value })}
                  className={inputClassName}
                />
              </div>
              <div>
                <FieldLabel hint="Color hex del botón">Color botón</FieldLabel>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.cta?.buttonColor ?? '#FFFFFF'}
                    onChange={(e) => patchCta({ buttonColor: e.target.value })}
                    className="h-10 w-12 cursor-pointer rounded border border-hub-border bg-transparent"
                  />
                  <input
                    value={branding.cta?.buttonColor ?? ''}
                    onChange={(e) => patchCta({ buttonColor: e.target.value })}
                    className={inputClassName}
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
            </div>
            <div>
              <FieldLabel hint="Base del diagnóstico. Con input activo se completa ?url= al enviar.">
                URL destino
              </FieldLabel>
              <input
                value={branding.cta?.url ?? ''}
                onChange={(e) => patchCta({ url: e.target.value })}
                className={inputClassName}
                placeholder="https://app.cleexs.net/diagnostico/crear?url="
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={branding.cta?.urlInput !== false}
                  onChange={(e) => patchCta({ urlInput: e.target.checked })}
                  className="h-4 w-4 rounded border-hub-border bg-[#0b1220] text-cleexs-blue"
                />
                Input de URL (diagnóstico prefilled)
              </label>
              <div>
                <FieldLabel>Placeholder del input</FieldLabel>
                <input
                  value={branding.cta?.placeholder ?? ''}
                  onChange={(e) => patchCta({ placeholder: e.target.value })}
                  className={inputClassName}
                  placeholder="https://tu-empresa.com"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-hub-border/70 bg-[#0b1220]/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-white">CTA variante B (A/B)</p>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={branding.ctaAbEnabled !== false && Boolean(branding.ctaB)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      patch({
                        ctaAbEnabled: true,
                        ctaB: branding.ctaB ?? {
                          headline: '¿Listo para ver cómo te ven ChatGPT y Google?',
                          body: 'Escribí tu URL y medí tu visibilidad en minutos.',
                          label: 'Probar diagnóstico gratis',
                        },
                      });
                    } else {
                      patch({ ctaAbEnabled: false });
                    }
                  }}
                  className="h-4 w-4 rounded border-hub-border bg-[#0b1220] text-cleexs-blue"
                />
                Activar A/B
              </label>
            </div>
            <p className="text-xs text-hub-muted">
              Teo asigna A o B por artículo (sticky). Los clics/envíos se miden con un pixel en
              la API.
            </p>
            <div>
              <FieldLabel>Título B</FieldLabel>
              <input
                value={branding.ctaB?.headline ?? ''}
                onChange={(e) => patchCtaB({ headline: e.target.value })}
                className={inputClassName}
                disabled={branding.ctaAbEnabled === false}
              />
            </div>
            <div>
              <FieldLabel>Texto B</FieldLabel>
              <textarea
                value={branding.ctaB?.body ?? ''}
                onChange={(e) => patchCtaB({ body: e.target.value })}
                rows={2}
                className={`${inputClassName} resize-y`}
                disabled={branding.ctaAbEnabled === false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Botón B</FieldLabel>
                <input
                  value={branding.ctaB?.label ?? ''}
                  onChange={(e) => patchCtaB({ label: e.target.value })}
                  className={inputClassName}
                  disabled={branding.ctaAbEnabled === false}
                />
              </div>
              <div>
                <FieldLabel>Color botón B</FieldLabel>
                <input
                  type="color"
                  value={branding.ctaB?.buttonColor ?? branding.cta?.buttonColor ?? '#FFFFFF'}
                  onChange={(e) => patchCtaB({ buttonColor: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded border border-hub-border bg-transparent"
                  disabled={branding.ctaAbEnabled === false}
                />
              </div>
            </div>
            {abStats ? (
              <div className="rounded-lg border border-hub-border/60 bg-hub-bg/40 p-3 text-xs text-slate-300">
                <p className="font-medium text-white">
                  Resultados {abStats.days}d
                  {abStats.winner ? ` · ganadora: ${abStats.winner}` : ' · sin datos aún'}
                </p>
                <p className="mt-1">
                  A: {abStats.byVariant.A.submit} envíos / {abStats.byVariant.A.click} clics (
                  {abStats.byVariant.A.total})
                </p>
                <p>
                  B: {abStats.byVariant.B.submit} envíos / {abStats.byVariant.B.click} clics (
                  {abStats.byVariant.B.total})
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Vista previa"
        description="Guardá la configuración y actualizá el preview para ver el artículo con esta marca."
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={loadPreview} className={buttonSecondaryClassName}>
            <span className="inline-flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {previewLoading ? 'Cargando…' : 'Actualizar preview'}
            </span>
          </button>
        </div>
        {previewHtml ? (
          <div className="overflow-hidden rounded-xl border border-hub-border bg-white">
            <iframe
              title="Preview artículo"
              srcDoc={previewHtml}
              className="h-[520px] w-full border-0 bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          <p className="text-sm text-hub-muted">Sin preview todavía.</p>
        )}
      </SettingsSection>
    </>
  );
}
