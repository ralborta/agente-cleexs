'use client';

import { useEffect, useState } from 'react';
import { Eye, Palette } from 'lucide-react';
import {
  FieldLabel,
  SettingsSection,
  buttonSecondaryClassName,
  inputClassName,
} from '@/components/config/settings-section';
import {
  fetchBrandPreview,
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
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const res = await fetchBrandPreview('cleexs');
      setPreviewHtml(res.html);
    } catch {
      setPreviewHtml(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
  }, [previewVersion]);

  function patch(partial: Partial<BrandKit>) {
    onChange({ ...branding, ...partial });
  }

  function patchCta(partial: NonNullable<BrandKit['cta']>) {
    onChange({ ...branding, cta: { ...branding.cta, ...partial } });
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
                <FieldLabel>URL destino</FieldLabel>
                <input
                  value={branding.cta?.url ?? ''}
                  onChange={(e) => patchCta({ url: e.target.value })}
                  className={inputClassName}
                />
              </div>
            </div>
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
