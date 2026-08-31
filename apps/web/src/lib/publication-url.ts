/** URL pública del artículo en {site}/articulos/slug/ (no preview ?p=). */
export function resolvePublicationUrl(
  url: string | null | undefined,
  slug: string | null | undefined,
  siteBase = 'https://cleexs.net',
): string | null {
  const WP_SITE = siteBase.replace(/\/$/, '') || 'https://cleexs.net';
  const raw = url?.trim();
  if (raw && raw.includes('/articulos/') && !raw.includes('?p=')) {
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  const cleanSlug = slug?.trim().replace(/^\/+|\/+$/g, '');
  if (cleanSlug) {
    return `${WP_SITE}/articulos/${cleanSlug}/`;
  }

  if (raw && !raw.includes('?p=') && raw !== WP_SITE && raw !== `${WP_SITE}/`) {
    return raw;
  }

  return null;
}
