import {
  BRAND_TEMPLATE_IDS,
  DEFAULT_BRAND_KIT,
  type BrandKit,
  type BrandTemplateId,
} from '@agente/shared';

export { DEFAULT_BRAND_KIT, type BrandKit, type BrandTemplateId };

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function hexToRgb(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixWithWhite(hex: string, ratio = 0.92): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  return `#${[mix(r), mix(g), mix(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

function sanitizeColor(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && HEX_COLOR.test(trimmed) ? trimmed : fallback;
}

function sanitizeUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function sanitizeTemplateId(value: string | undefined): BrandTemplateId {
  if (value && (BRAND_TEMPLATE_IDS as readonly string[]).includes(value)) {
    return value as BrandTemplateId;
  }
  return 'default';
}

/** Fusiona branding guardado en DB con defaults (Cleexs u org del workspace). */
export function resolveBrandKit(
  stored: unknown,
  workspaceName?: string | null,
): BrandKit {
  const raw = (stored && typeof stored === 'object' ? stored : {}) as Partial<BrandKit>;
  const brandName =
    raw.brandName?.trim() || workspaceName?.trim() || DEFAULT_BRAND_KIT.brandName!;
  const primary = sanitizeColor(raw.primaryColor, DEFAULT_BRAND_KIT.primaryColor!);
  const secondary = sanitizeColor(
    raw.secondaryColor ?? primary,
    DEFAULT_BRAND_KIT.secondaryColor!,
  );

  const defaultAuthor =
    DEFAULT_BRAND_KIT.authorLine?.replace('Cleexs', brandName) ??
    `Por el equipo de ${brandName}`;

  return {
    templateId: sanitizeTemplateId(raw.templateId),
    brandName,
    primaryColor: primary,
    secondaryColor: secondary,
    fontFamily: raw.fontFamily?.trim() || DEFAULT_BRAND_KIT.fontFamily,
    logoUrl: sanitizeUrl(raw.logoUrl),
    authorLine: raw.authorLine?.trim() || defaultAuthor,
    cta: {
      headline: raw.cta?.headline?.trim() || DEFAULT_BRAND_KIT.cta?.headline,
      body: raw.cta?.body?.trim() || DEFAULT_BRAND_KIT.cta?.body?.replace(/Cleexs/g, brandName),
      label: raw.cta?.label?.trim() || DEFAULT_BRAND_KIT.cta?.label,
      url: sanitizeUrl(raw.cta?.url) || DEFAULT_BRAND_KIT.cta?.url,
    },
  };
}

export type BrandCssTokens = {
  primary: string;
  secondary: string;
  primarySoft: string;
  primaryText: string;
  fontFamily: string;
  templateId: BrandTemplateId;
};

export function brandCssTokens(kit: BrandKit): BrandCssTokens {
  const primary = kit.primaryColor ?? DEFAULT_BRAND_KIT.primaryColor!;
  const secondary = kit.secondaryColor ?? kit.primaryColor ?? DEFAULT_BRAND_KIT.secondaryColor!;
  return {
    primary,
    secondary,
    primarySoft: mixWithWhite(primary),
    primaryText: mixWithWhite(primary, 0.75),
    fontFamily: kit.fontFamily ?? DEFAULT_BRAND_KIT.fontFamily!,
    templateId: kit.templateId ?? 'default',
  };
}

export function formatAuthorLine(kit: BrandKit): string {
  const line = kit.authorLine ?? DEFAULT_BRAND_KIT.authorLine!;
  return line.replace(/\{brandName\}/g, kit.brandName ?? 'Marca');
}
