/** Igual que Cleexs: http(s), www y dominios tipo empresa.com */
const URL_IN_TEXT =
  /(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(?:\/[^\s]*)?/gi;

export function sanitizeInboundText(raw: unknown): string {
  return `${raw ?? ''}`.replace(/\u0000/g, '').trim();
}

export function extractUrlFromMessage(text: string): string | null {
  const cleaned = sanitizeInboundText(text);
  if (!cleaned) return null;
  for (const m of cleaned.matchAll(URL_IN_TEXT)) {
    const host = (m[1] || '').toLowerCase();
    if (host.length < 4 || host.endsWith('.png') || host.endsWith('.jpg')) continue;
    const raw = m[0].trim().replace(/[.,;:!?)]+$/, '');
    return raw.startsWith('http') ? raw : `https://${raw.replace(/^www\./i, '')}`;
  }
  return null;
}

export interface NormalizedInbound {
  phone: string;
  chatId: string;
  name: string | null;
  body: string;
  mediaUrl: string | null;
  mediaKind: string | null;
}

export function normalizeBuilderBotPayload(body: Record<string, unknown>): NormalizedInbound | null {
  const eventName = `${body.eventName ?? ''}`.trim();
  const direction = `${body.direction ?? ''}`.trim().toLowerCase();

  if (
    direction === 'out' ||
    direction === 'outbound' ||
    direction === 'outgoing' ||
    /outgoing|message\.sent|message\.send/.test(eventName.toLowerCase())
  ) {
    return null;
  }

  if (eventName && eventName !== 'message.incoming') {
    return null;
  }

  const data = (body.data ?? {}) as Record<string, unknown>;
  const phone = `${data.from ?? ''}`.replace(/\D/g, '');
  if (phone.length < 8) return null;

  const rawBody = sanitizeInboundText(data.body ?? data.message ?? data.answer);
  if (!rawBody || /^_event_/i.test(rawBody)) return null;

  const mediaUrl =
    typeof data.urlTempFile === 'string'
      ? data.urlTempFile
      : Array.isArray(data.attachment) && typeof data.attachment[0]?.url === 'string'
        ? data.attachment[0].url
        : null;

  return {
    phone,
    chatId: phone,
    name: typeof data.name === 'string' ? data.name : null,
    body: rawBody,
    mediaUrl,
    mediaKind: typeof data.mediaKind === 'string' ? data.mediaKind : null,
  };
}
