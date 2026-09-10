const TRACKING_PARAM_RE = /^(utm_.*|gclid|fbclid|mc_cid|mc_eid|_ga|ref)$/i;

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return trimmed.toLowerCase();
  }

  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443')
  ) {
    parsed.port = '';
  }

  const kept = new URLSearchParams();
  parsed.searchParams.forEach((value, key) => {
    if (TRACKING_PARAM_RE.test(key)) return;
    kept.append(key, value);
  });
  const qs = kept.toString();
  parsed.search = qs ? `?${qs}` : '';

  let path = parsed.pathname || '/';
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  parsed.pathname = path;

  return parsed.toString();
}

export function extractDomain(raw: string): string {
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function isOwnSite(url: string, siteHosts: string[]): boolean {
  const domain = extractDomain(url);
  if (!domain || !siteHosts.length) return false;
  const hosts = siteHosts
    .map((h) => h.trim().toLowerCase().replace(/^www\./, '').replace(/\/$/, ''))
    .filter(Boolean)
    .map((h) => {
      try {
        return extractDomain(h.includes('://') ? h : `https://${h}`) || h;
      } catch {
        return h;
      }
    });

  return hosts.some(
    (host) => domain === host || domain.endsWith(`.${host}`),
  );
}
