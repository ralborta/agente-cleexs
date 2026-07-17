/**
 * Puente al asistente Cleexs (mismo prompt BBC «Consultas IA» / saludo).
 * Patrón Andreu: el bot Baileys transporta; la lógica vive en API (acá → Cleexs Railway).
 */

const GREETING_KEYWORDS = new Set([
  'hola',
  'holaa',
  'hola!',
  'buenas',
  'buenas!',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
  'hi',
  'hello',
]);

/** Texto exacto del flow BBC «Cleexs - Saludo». */
export const CLEEXS_BBC_GREETING =
  '¡Hola! 👋 Soy *Cleexs*. Te digo gratis qué tan probable es que ChatGPT recomiende tu marca.\n\n' +
  '👉 Pasame la URL de tu sitio (ej. tuempresa.com).';

export function isCleexsGreeting(message: string): boolean {
  const t = `${message || ''}`.trim().toLowerCase();
  if (!t || t.length > 40) return false;
  const normalized = t.replace(/[¡!?.]+$/g, '').trim();
  return GREETING_KEYWORDS.has(t) || GREETING_KEYWORDS.has(normalized);
}

export async function askCleexsWhatsAppAssistant(params: {
  phone: string;
  message: string;
}): Promise<{ message: string; flow: string } | null> {
  const base = (process.env.CLEEXS_API_URL || '').trim().replace(/\/$/, '');
  const channelKey = (process.env.WHATSAPP_CHANNEL_API_KEY || '').trim();
  if (!base || !channelKey) return null;

  const res = await fetch(`${base}/api/public/whatsapp/assistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cleexs-channel-key': channelKey,
    },
    body: JSON.stringify({
      from: params.phone,
      body: params.message,
      message: params.message,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const text = await res.text().catch(() => '');
  let parsed: { message?: string; flow?: string; code?: string } = {};
  try {
    parsed = text ? (JSON.parse(text) as typeof parsed) : {};
  } catch {
    return null;
  }

  const reply = `${parsed.message || ''}`.trim();
  if (!reply) return null;
  return { message: reply, flow: parsed.flow || 'consultas_ia' };
}
