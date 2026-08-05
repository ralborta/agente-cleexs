/**
 * IndexNow — notifica a Bing y motores adheridos al publicar/actualizar URLs.
 * Docs: https://www.indexnow.org/documentation
 */
export type IndexNowConfig = {
  key: string;
  /** URL absoluta del archivo {key}.txt (debe contener solo la key). */
  keyLocation: string;
  host: string;
};

export type IndexNowResult = {
  ok: boolean;
  skipped?: boolean;
  detail: string;
  status?: number;
};

export function resolveIndexNowConfig(siteBaseUrl: string | null | undefined): IndexNowConfig | null {
  const key =
    process.env.INDEXNOW_KEY?.trim() ||
    process.env.CLEEXS_INDEXNOW_KEY?.trim() ||
    '';
  if (!key || !siteBaseUrl) return null;

  const root = siteBaseUrl.replace(/\/$/, '');
  let host: string;
  try {
    host = new URL(root).host;
  } catch {
    return null;
  }

  const keyLocation =
    process.env.INDEXNOW_KEY_LOCATION?.trim() || `${root}/${key}.txt`;

  return { key, keyLocation, host };
}

export async function submitUrlsToIndexNow(
  config: IndexNowConfig,
  urls: string[],
): Promise<IndexNowResult> {
  const urlList = [...new Set(urls.filter(Boolean))];
  if (!urlList.length) {
    return { ok: false, skipped: true, detail: 'Sin URLs para IndexNow' };
  }

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'CleexsTeoIndexNow/1.0',
      },
      body: JSON.stringify({
        host: config.host,
        key: config.key,
        keyLocation: config.keyLocation,
        urlList,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    // IndexNow: 200/202 = ok; 422 = key inválida; 403 = key no verificable
    if (res.status === 200 || res.status === 202) {
      return {
        ok: true,
        status: res.status,
        detail: `IndexNow ${res.status} · ${urlList.length} URL(s)`,
      };
    }

    const body = await res.text().catch(() => '');
    return {
      ok: false,
      status: res.status,
      detail: `IndexNow ${res.status}: ${body.slice(0, 300) || 'sin cuerpo'}`,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : 'Error IndexNow',
    };
  }
}
