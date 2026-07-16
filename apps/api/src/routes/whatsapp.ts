import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';
import {
  fetchBaileysBotStatus,
  isWhatsAppSendConfigured,
  sendWhatsAppMessage,
} from '../lib/whatsapp/builderbot-send';

const whatsappRoutes: FastifyPluginAsync = async (server) => {
  server.get('/status', async () => {
    const botStatus = await fetchBaileysBotStatus();
    return {
      sendConfigured: isWhatsAppSendConfigured(),
      baileysBotUrl: process.env.BAILEYS_BOT_URL?.trim() || null,
      bot: botStatus,
      cleexsBridge: Boolean(
        process.env.CLEEXS_API_URL?.trim() && process.env.WHATSAPP_CHANNEL_API_KEY?.trim(),
      ),
    };
  });

  server.get('/conversations', async (request) => {
    const { limit = '50' } = request.query as { limit?: string };
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);

    const rows = await prisma.whatsAppMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });

    const byChat = new Map<
      string,
      {
        chatId: string;
        phoneDigits: string | null;
        lastMessage: string;
        lastAt: Date;
        direction: string;
      }
    >();

    for (const row of rows) {
      if (byChat.has(row.chatId)) continue;
      byChat.set(row.chatId, {
        chatId: row.chatId,
        phoneDigits: row.phoneDigits,
        lastMessage: row.message.slice(0, 200),
        lastAt: row.createdAt,
        direction: row.direction,
      });
    }

    return { conversations: [...byChat.values()] };
  });

  server.get('/messages', async (request, reply) => {
    const { chatId, limit = '100' } = request.query as { chatId?: string; limit?: string };
    if (!chatId) {
      return reply.code(400).send({ error: 'chatId requerido' });
    }

    const take = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const messages = await prisma.whatsAppMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take,
    });

    return { chatId, messages };
  });

  server.post('/send-test', async (request, reply) => {
    const { number, message } = (request.body ?? {}) as { number?: string; message?: string };
    if (!number?.trim() || !message?.trim()) {
      return reply.code(400).send({ error: 'number y message requeridos' });
    }

    await sendWhatsAppMessage({
      number: number.trim(),
      message: message.trim(),
      logSource: 'admin_test',
    });

    return { ok: true };
  });
};

export default whatsappRoutes;
