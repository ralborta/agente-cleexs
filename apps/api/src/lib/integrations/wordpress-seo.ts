export type WordPressSeoInput = {
  metaTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
};

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
