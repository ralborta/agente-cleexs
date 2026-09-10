import { lookup } from 'dns/promises';
import { isIP } from 'net';

export type SafeFetchResult = {
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string | null;
  text: string;
  error?: string;
};

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
};

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return -1;
  }
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

/** Bloquea IPs privadas, loopback, link-local y metadata cloud. */
export function isPrivateIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  if (!v) return true;

  if (v === '::1' || v === '0:0:0:0:0:0:0:1') return true;
  if (v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) return true;
  if (v.startsWith('::ffff:')) {
    return isPrivateIp(v.slice(7));
  }

  const n = ipv4ToInt(v);
  if (n < 0) {
    // IPv6 no clasificado arriba: permitir solo si parece público genérico
    return v.includes(':') ? /^(fc|fd|fe80|::1)/i.test(v) : true;
  }

  // 0.0.0.0/8, 127.0.0.0/8
  if ((n >>> 24) === 0 || (n >>> 24) === 127) return true;
  // 10.0.0.0/8
  if ((n >>> 24) === 10) return true;
  // 172.16.0.0/12
  if ((n >>> 24) === 172 && ((n >>> 16) & 0xff) >= 16 && ((n >>> 16) & 0xff) <= 31) {
    return true;
  }
  // 192.168.0.0/16
  if ((n >>> 24) === 192 && ((n >>> 16) & 0xff) === 168) return true;
  // 169.254.0.0/16 (link-local + metadata 169.254.169.254)
  if ((n >>> 24) === 169 && ((n >>> 16) & 0xff) === 254) return true;
  // 100.64.0.0/10 CGNAT
  if ((n >>> 24) === 100 && ((n >>> 16) & 0xff) >= 64 && ((n >>> 16) & 0xff) <= 127) {
    return true;
  }

  return false;
}

export function isPrivateHostnameOrIp(hostOrIp: string): boolean {
  const h = hostOrIp.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (
    h === 'localhost' ||
    h === 'metadata' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal')
  ) {
    return true;
  }
  if (isIP(h)) return isPrivateIp(h);
  return false;
}

async function assertHostSafe(hostname: string): Promise<void> {
  if (isPrivateHostnameOrIp(hostname)) {
    throw new Error(`Host bloqueado (privado/local): ${hostname}`);
  }
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error(`IP privada bloqueada: ${hostname}`);
    return;
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch (err) {
    throw new Error(
      `DNS falló para ${hostname}: ${err instanceof Error ? err.message : 'error'}`,
    );
  }
  if (!records.length) throw new Error(`Sin registros DNS para ${hostname}`);
  for (const r of records) {
    if (isPrivateIp(r.address)) {
      throw new Error(`DNS resolvió a IP privada (${r.address}) para ${hostname}`);
    }
  }
}

async function readBodyLimited(
  res: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) {
    const text = await res.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      return { text: text.slice(0, maxBytes), truncated: true };
    }
    return { text, truncated: false };
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      const remain = maxBytes - (total - value.byteLength);
      if (remain > 0) chunks.push(value.slice(0, remain));
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { text: buf.toString('utf8'), truncated };
}

/**
 * Fetch SSRF-safe: solo http(s), DNS + bloqueo de IPs privadas,
 * revalidación en cada redirect (máx 3), timeout y tope de bytes.
 */
export async function safeFetchPage(
  url: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maxBytes = options.maxBytes ?? 500_000;
  const maxRedirects = options.maxRedirects ?? 3;
  const ua =
    options.userAgent ??
    'CleexsGrowthBot/1.0 (+https://cleexs.com; conversation-verify)';

  let current = url.trim();
  let redirects = 0;

  try {
    while (true) {
      let parsed: URL;
      try {
        parsed = new URL(current);
      } catch {
        return {
          ok: false,
          status: 0,
          finalUrl: current,
          contentType: null,
          text: '',
          error: 'URL inválida',
        };
      }

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          ok: false,
          status: 0,
          finalUrl: current,
          contentType: null,
          text: '',
          error: 'Solo http/https',
        };
      }

      await assertHostSafe(parsed.hostname);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(parsed.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': ua,
            Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          },
        });
      } finally {
        clearTimeout(timer);
      }

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location');
        if (!loc) {
          return {
            ok: false,
            status: res.status,
            finalUrl: current,
            contentType: res.headers.get('content-type'),
            text: '',
            error: 'Redirect sin Location',
          };
        }
        redirects += 1;
        if (redirects > maxRedirects) {
          return {
            ok: false,
            status: res.status,
            finalUrl: current,
            contentType: res.headers.get('content-type'),
            text: '',
            error: 'Demasiados redirects',
          };
        }
        current = new URL(loc, parsed).toString();
        continue;
      }

      const contentType = res.headers.get('content-type');
      const { text } = await readBodyLimited(res, maxBytes);
      return {
        ok: res.ok,
        status: res.status,
        finalUrl: parsed.toString(),
        contentType,
        text,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch error';
    return {
      ok: false,
      status: 0,
      finalUrl: current,
      contentType: null,
      text: '',
      error: message,
    };
  }
}
