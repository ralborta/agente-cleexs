import { prisma } from '../prisma';

export type WhatsAppDirection = 'inbound' | 'outbound';

export interface LogWhatsAppParams {
  chatId: string;
  message: string;
  direction: WhatsAppDirection;
  source?: string;
  mediaUrl?: string | null;
  status?: string;
  externalId?: string | null;
  errorMessage?: string | null;
}

export function phoneDigitsFromChatId(chatId: string): string | null {
  const digits = `${chatId || ''}`.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export async function logWhatsAppMessage(params: LogWhatsAppParams): Promise<void> {
  const {
    chatId,
    message,
    direction,
    source = null,
    mediaUrl = null,
    status = direction === 'inbound' ? 'received' : 'sent',
    externalId = null,
    errorMessage = null,
  } = params;

  try {
    await prisma.whatsAppMessage.create({
      data: {
        chatId,
        phoneDigits: phoneDigitsFromChatId(chatId),
        direction,
        message,
        mediaUrl,
        status,
        source,
        externalId,
        errorMessage,
      },
    });
  } catch (err) {
    console.error('[whatsapp-log] no se pudo persistir mensaje', err);
  }
}
