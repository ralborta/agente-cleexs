/**
 * Google Indexing API — notifica URL_UPDATED / URL_DELETED.
 * Scope: https://www.googleapis.com/auth/indexing
 * La service account debe ser propietaria del property en Search Console.
 */
import { googleFetch } from './google-auth';
import type { GoogleMetricsConfig } from './google-config';

export const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';

export type IndexingNotifyResult = {
  ok: boolean;
  skipped?: boolean;
  detail: string;
  notifyTime?: string | null;
};

export async function notifyUrlUpdated(
  config: GoogleMetricsConfig,
  url: string,
): Promise<IndexingNotifyResult> {
  try {
    const res = await googleFetch<{ urlNotificationMetadata?: { latestUpdate?: { notifyTime?: string } } }>(
      config,
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      {
        method: 'POST',
        scopes: [INDEXING_SCOPE],
        body: JSON.stringify({
          url,
          type: 'URL_UPDATED',
        }),
      },
    );
    const notifyTime = res.urlNotificationMetadata?.latestUpdate?.notifyTime ?? null;
    return {
      ok: true,
      detail: notifyTime ? `Notificado ${notifyTime}` : 'URL_UPDATED aceptado',
      notifyTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error Indexing API';
    return { ok: false, detail: message.slice(0, 500) };
  }
}
