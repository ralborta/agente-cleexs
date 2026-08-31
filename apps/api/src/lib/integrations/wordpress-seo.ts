export type WordPressSeoInput = {
  metaTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
};

/** Nombre corto del sitio (Astra lo muestra junto al logo en el header). */
export const WP_HEADER_SITE_NAME = 'Cleexs';
/** Título de la página de inicio (Astra lo usa como ítem del menú). */
export const WP_HEADER_HOME_NAV_TITLE = 'Inicio';
/** Frase larga: solo Rank Math / <title> / og:title — nunca blogname ni post_title. */
export const HOME_SEO_TITLE = 'Cleexs - Conseguí clientes desde ChatGPT';
export const HOME_SEO_DESCRIPTION = 'Conseguí clientes desde ChatGPT con Cleexs.';

const HEADER_SITE_BY_WORKSPACE: Record<string, string> = {
  cleexs: 'Cleexs',
  empleados: 'Empleados',
};

/** Nombre corto para blogname / header (nunca la frase SEO larga). */
export function resolveHeaderSiteName(
  workspaceSlug: string,
  brandName?: string | null,
): string {
  const fromBrand = brandName?.trim();
  if (fromBrand) return fromBrand;
  return HEADER_SITE_BY_WORKSPACE[workspaceSlug] ?? WP_HEADER_SITE_NAME;
}

/**
 * True si el texto es copy SEO/meta y no un label de header/menú.
 * Astra muestra logo + blogname a la izquierda y el título de la página Inicio a la derecha:
 * meter la frase larga ahí duplica el texto en cada artículo.
 */
export function looksLikeSeoHeadline(
  value: string,
  siteName = WP_HEADER_SITE_NAME,
): boolean {
  const t = value.trim();
  if (!t) return false;
  if (t === siteName || t === WP_HEADER_HOME_NAV_TITLE) return false;
  if (/ [-–—|] /.test(t) || t.includes(' - ')) return true;
  return t.length > 24;
}

export function resolveSeoPlugin(): 'rankmath' | 'yoast' | null {
  const raw = (process.env.WORDPRESS_SEO_PLUGIN ?? '').trim().toLowerCase();
  if (raw === 'rankmath' || raw === 'rank_math' || raw === 'rank-math') return 'rankmath';
  if (raw === 'yoast' || raw === 'yoast_seo') return 'yoast';
  return null;
}

/** Campos meta para REST API según plugin SEO configurado. */
export function buildWordPressSeoMetaFields(seo: WordPressSeoInput): Record<string, unknown> {
  const plugin = resolveSeoPlugin();
  if (!plugin) return {};

  const title = seo.metaTitle?.trim();
  const description = seo.metaDescription?.trim();
  const keyword = seo.focusKeyword?.trim();

  if (plugin === 'rankmath') {
    const meta: Record<string, string> = {};
    if (title) meta.rank_math_title = title;
    if (description) meta.rank_math_description = description;
    if (keyword) meta.rank_math_focus_keyword = keyword;
    return Object.keys(meta).length ? { meta } : {};
  }

  const meta: Record<string, string> = {};
  if (title) meta._yoast_wpseo_title = title;
  if (description) meta._yoast_wpseo_metadesc = description;
  if (keyword) meta._yoast_wpseo_focuskw = keyword;
  return Object.keys(meta).length ? { meta } : {};
}

export function hasSeoPluginConfigured(): boolean {
  return resolveSeoPlugin() !== null;
}

export function buildSeoMetaPayload(seo: WordPressSeoInput): Record<string, string> {
  const plugin = resolveSeoPlugin();
  if (!plugin) return {};

  const title = seo.metaTitle?.trim();
  const description = seo.metaDescription?.trim();
  const keyword = seo.focusKeyword?.trim();
  const meta: Record<string, string> = {};

  if (plugin === 'rankmath') {
    if (title) meta.rank_math_title = title;
    if (description) meta.rank_math_description = description;
    if (keyword) meta.rank_math_focus_keyword = keyword;
  } else {
    if (title) meta._yoast_wpseo_title = title;
    if (description) meta._yoast_wpseo_metadesc = description;
    if (keyword) meta._yoast_wpseo_focuskw = keyword;
  }

  return meta;
}
