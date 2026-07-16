import { logWhatsAppMessage } from './message-log';

const BAILEYS_BOT_URL = (process.env.BAILEYS_BOT_URL || '').trim().replace(/\/$/, '');
const BUILDERBOT_BASE = (process.env.BUILDERBOT_BASE_URL || 'https://app.builderbot.cloud').replace(/\/$/, '');

export function isWhatsAppSendConfigured(): boolean {
  if (BAILEYS_BOT_URL) return true;
  const botId = (process.env.BUILDERBOT_BOT_ID || '').trim();
  const apiKey = (process.env.BUILDERBOT_API_KEY || '').trim();
  return Boolean(botId && apiKey);
}

export function formatWhatsAppRecipient(raw: string): string {
  const s = `${raw || ''}`.trim();
  if (!s) return '';
  if (s.includes('@')) return s;
  return s.replace(/\D/g, '') || s;
}

export interface SendWhatsAppOptions {
  number: string;
  message: string;
  mediaUrl?: string;
  checkIfExists?: boolean;
  logSource?: string;
}

async function sendViaBaileysBot(options: SendWhatsAppOptions): Promise<unknown> {
  const phone = formatWhatsAppRecipient(options.number);
  const res = await fetch(`${BAILEYS_BOT_URL}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: phone,
      message: options.message || ' ',
      urlMedia: options.mediaUrl ?? null,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const raw = await res.text().catch(() => '');
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = { error: raw.slice(0, 200) };
  }

  if (!res.ok) {
    throw new Error(String(data.error || `Bot Baileys respondió ${res.status}`));
  }
  return data;
}

async function sendViaBuilderBotCloud(options: SendWhatsAppOptions): Promise<unknown> {
  const botId = (process.env.BUILDERBOT_BOT_ID || '').trim();
  const apiKey = (process.env.BUILDERBOT_API_KEY || '').trim();

  if (!botId || !apiKey) {
    throw new Error('BuilderBot: definí BUILDERBOT_BOT_ID y BUILDERBOT_API_KEY, o BAILEYS_BOT_URL');
  }

  const recipient = formatWhatsAppRecipient(options.number);
  if (!recipient) throw new Error('WhatsApp: número de destino vacío');

  const body: Record<string, unknown> = {
    messages: { content: options.message, ...(options.mediaUrl ? { mediaUrl: options.mediaUrl } : {}) },
    number: recipient,
    checkIfExists: options.checkIfExists ?? false,
  };

  const res = await fetch(`${BUILDERBOT_BASE}/api/v2/${botId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-builderbot': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`BuilderBot send failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  return res.json().catch(() => ({}));
}

export async function sendWhatsAppTyping(number: string): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!BAILEYS_BOT_URL) return { ok: true, skipped: true };
  const phone = formatWhatsAppRecipient(number);
  if (phone.length < 9) return { ok: false };

  const res = await fetch(`${BAILEYS_BOT_URL}/v1/typing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: phone }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText.slice(0, 200) || `Bot Baileys typing ${res.status}`);
  }
  return { ok: true };
}

export async function sendWhatsAppMessage(options: SendWhatsAppOptions): Promise<unknown> {
  const { logSource = 'api_send' } = options;
  const chatId = formatWhatsAppRecipient(options.number);

  try {
    const result = BAILEYS_BOT_URL
      ? await sendViaBaileysBot(options)
      : await sendViaBuilderBotCloud(options);

    void logWhatsAppMessage({
      chatId,
      message: options.message,
      direction: 'outbound',
      source: logSource,
      mediaUrl: options.mediaUrl ?? null,
      status: 'sent',
    });

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    void logWhatsAppMessage({
      chatId,
      message: options.message,
      direction: 'outbound',
      source: logSource,
      mediaUrl: options.mediaUrl ?? null,
      status: 'failed',
      errorMessage,
    });
    throw err;
  }
}

export async function fetchBaileysBotStatus(): Promise<Record<string, unknown> | null> {
  if (!BAILEYS_BOT_URL) return null;
  const res = await fetch(`${BAILEYS_BOT_URL}/health`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  return (await res.json().catch(() => ({ ok: false }))) as Record<string, unknown>;
}
