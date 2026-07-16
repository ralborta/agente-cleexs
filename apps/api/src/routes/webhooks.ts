import type { FastifyPluginAsync } from 'fastify';
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

const webhookRoutes: FastifyPluginAsync = async (server) => {
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
        void logWhatsAppMessage({
          chatId: inbound.chatId,
          message: replyText,
          direction: 'outbound',
          source: 'cleexs_diagnostic',
          status: 'pending_bot_send',
        });
        return reply.send({ received: true, flow: 'diagnostic_url', message: replyText });
      }

      return reply.send({ received: true, flow: 'diagnostic_url', code: cleexs?.code ?? 'no_reply' });
    }

    return reply.send({ received: true, flow: 'logged' });
  });
};

export default webhookRoutes;
