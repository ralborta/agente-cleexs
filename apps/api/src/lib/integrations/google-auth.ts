import { GoogleAuth } from 'google-auth-library';
import type { GoogleMetricsConfig } from './google-config';

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

export async function getGoogleAccessToken(
  config: GoogleMetricsConfig,
  scopes: string[] = [GSC_SCOPE, GA4_SCOPE],
): Promise<string> {
  const auth = new GoogleAuth({
    credentials: config.serviceAccount,
    scopes,
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) {
    throw new Error('No se pudo obtener access token de Google');
  }
  return token.token;
}

export async function googleFetch<T>(
  config: GoogleMetricsConfig,
  url: string,
  init?: RequestInit & { scopes?: string[] },
): Promise<T> {
  const token = await getGoogleAccessToken(config, init?.scopes);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google API ${res.status}: ${body.slice(0, 400)}`);
  }

  return res.json() as Promise<T>;
}
