import type { FastifyPluginAsync } from 'fastify';
import { askCleexsWhatsAppAssistant, CLEEXS_BBC_GREETING, isCleexsGreeting } from '../lib/whatsapp/cleexs-assistant';
import { sendWhatsAppMessage } from '../lib/whatsapp/builderbot-send';
import { logWhatsAppMessage } from '../lib/whatsapp/message-log';
import { normalizeBuilderBotPayload, extractUrlFromMessage } from '../lib/whatsapp/normalize-payload';

interface CleexsWaUrlResponse {
  reply?: string;
  code?: string;
  ready?: boolean;
}

async function forwardDiagnosticUrlToCleexs(params: {
  phone: string;
  message: string;
}): Promise<CleexsWaUrlResponse | null> {
  const base = (process.env.CLEEXS_API_URL || '').trim().replace(/\/$/, '');
  const channelKey = (process.env.WHATSAPP_CHANNEL_API_KEY || '').trim();
  if (!base || !channelKey) return null;

  const res = await fetch(`${base}/api/public/diagnostic/whatsapp/url`, {
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
  try {
    return text ? (JSON.parse(text) as CleexsWaUrlResponse) : {};
  } catch {
    return { reply: text.slice(0, 500), code: 'parse_error' };
  }
}

/** Como Andreu: la API entrega el texto al bot Baileys (return message no alcanza). */
async function deliverReply(params: {
  phone: string;
  message: string;
  flow: string;
  source: string;
  log: { error: (obj: unknown, msg?: string) => void };
}): Promise<{ sent: boolean; error?: string }> {
  try {
    await sendWhatsAppMessage({
      number: params.phone,
      message: params.message,
      logSource: params.source,
    });
    return { sent: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    params.log.error({ err, phone: params.phone, flow: params.flow }, 'WA send falló');
    return { sent: false, error };
  }
}

const webhookRoutes: FastifyPluginAsync = async (server) => {
  /**
   * Mismo contrato que Andreu Baileys:
   * bot reenvía → API decide → API manda por POST /v1/messages
   */
  server.post('/builderbot', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    server.log.info({ eventName: body.eventName }, 'WA webhook recibido');

    const inbound = normalizeBuilderBotPayload(body);
    if (!inbound) {
      return reply.send({ received: true, skipped: 'not_inbound' });
    }

    await logWhatsAppMessage({
      chatId: inbound.chatId,
      message: inbound.body,
      direction: 'inbound',
      source: 'builderbot_webhook',
      mediaUrl: inbound.mediaUrl,
    });

    const hasUrl = Boolean(extractUrlFromMessage(inbound.body));
    if (hasUrl) {
      const cleexs = await forwardDiagnosticUrlToCleexs({
        phone: inbound.phone,
        message: inbound.body,
      });

      const replyText = `${cleexs?.reply ?? ''}`.trim();
      if (replyText) {
        const delivery = await deliverReply({
          phone: inbound.phone,
          message: replyText,
          flow: 'diagnostic_url',
          source: 'cleexs_diagnostic',
          log: server.log,
        });
        return reply.send({
          received: true,
          flow: 'diagnostic_url',
          message: replyText,
          sent: delivery.sent,
          sendError: delivery.error,
        });
      }

      return reply.send({ received: true, flow: 'diagnostic_url', code: cleexs?.code ?? 'no_reply' });
    }

    if (isCleexsGreeting(inbound.body)) {
      const delivery = await deliverReply({
        phone: inbound.phone,
        message: CLEEXS_BBC_GREETING,
        flow: 'saludo',
        source: 'bbc_saludo',
        log: server.log,
      });
      return reply.send({
        received: true,
        flow: 'saludo',
        message: CLEEXS_BBC_GREETING,
        sent: delivery.sent,
        sendError: delivery.error,
      });
    }

    try {
      const assistant = await askCleexsWhatsAppAssistant({
        phone: inbound.phone,
        message: inbound.body,
      });
      if (assistant?.message) {
        const delivery = await deliverReply({
          phone: inbound.phone,
          message: assistant.message,
          flow: assistant.flow || 'consultas_ia',
          source: 'bbc_consultas_ia',
          log: server.log,
        });
        return reply.send({
          received: true,
          flow: assistant.flow || 'consultas_ia',
          message: assistant.message,
          sent: delivery.sent,
          sendError: delivery.error,
        });
      }
    } catch (err) {
      server.log.error({ err }, 'WA assistant Cleexs falló');
    }

    return reply.send({ received: true, flow: 'logged', code: 'assistant_unavailable' });
  });
};

export default webhookRoutes;
