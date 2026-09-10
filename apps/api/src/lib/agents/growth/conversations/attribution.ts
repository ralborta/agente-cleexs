import { randomBytes } from 'crypto';

/** ID opaco sin PII (hex). */
export function createAttributionId(): string {
  return randomBytes(16).toString('hex');
}

export function buildAttributedArticleUrl(baseUrl: string, attributionId: string): string {
  const url = new URL(baseUrl.includes('://') ? baseUrl : `https://${baseUrl}`);
  url.searchParams.set('utm_source', 'growth_conversations');
  url.searchParams.set('utm_medium', 'forum');
  url.searchParams.set('utm_campaign', 'teo');
  url.searchParams.set('utm_content', attributionId);
  return url.toString();
}
