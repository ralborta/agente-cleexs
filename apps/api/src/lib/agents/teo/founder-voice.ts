/**
 * Sprint 2.2 — voz del founder/CEO.
 * Opcional: si no hay frases, Teo publica igual (no bloquea).
 */
import { randomBytes } from 'crypto';
import { prisma } from '../../prisma';
import type { ArticleData } from './article-template';
import type { StrategistPlan } from './types';

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_QUOTES_PER_PIECE = 3;

function normalizeTopic(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function topicMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeTopic(a);
  const right = normalizeTopic(b);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

export function frontendBaseUrl(): string {
  return (
    process.env.FRONTEND_URL?.trim() ||
    process.env.FRONTEND_URLS?.split(',')[0]?.trim() ||
    'https://agents.cleexs.net'
  );
}

export async function createFounderVoiceInvite(input: {
  workspaceId: string;
  topic?: string | null;
  missionId?: string | null;
}): Promise<{ inviteId: string; token: string; url: string; expiresAt: Date }> {
  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const invite = await prisma.founderVoiceInvite.create({
    data: {
      workspaceId: input.workspaceId,
      token,
      topic: input.topic?.trim() || null,
      missionId: input.missionId ?? null,
      expiresAt,
    },
  });
  return {
    inviteId: invite.id,
    token,
    url: `${frontendBaseUrl()}/voz/${token}`,
    expiresAt,
  };
}

export async function getInviteByToken(token: string) {
  const invite = await prisma.founderVoiceInvite.findUnique({
    where: { token },
    include: { workspace: { select: { name: true, slug: true } } },
  });
  if (!invite) return null;
  if (invite.expiresAt.getTime() < Date.now()) {
    return { ...invite, expired: true as const };
  }
  return { ...invite, expired: false as const };
}

export async function submitQuotesForInvite(input: {
  token: string;
  quotes: string[];
  authorLabel?: string;
}): Promise<{ created: number; topic: string | null }> {
  const invite = await getInviteByToken(input.token);
  if (!invite || invite.expired) {
    throw new Error('Link vencido o inválido');
  }

  const clean = [
    ...new Set(
      input.quotes
        .map((q) => q.replace(/\s+/g, ' ').trim())
        .filter((q) => q.length >= 12 && q.length <= 600),
    ),
  ].slice(0, 5);

  if (!clean.length) {
    throw new Error('Pegá al menos 2 frases (mín. 12 caracteres cada una)');
  }

  let created = 0;
  for (const quote of clean) {
    await prisma.founderVoiceNote.create({
      data: {
        workspaceId: invite.workspaceId,
        topic: invite.topic,
        quote,
        authorLabel: input.authorLabel?.trim() || 'Founder',
        status: 'available',
        inviteId: invite.id,
      },
    });
    created += 1;
  }

  await prisma.founderVoiceInvite.update({
    where: { id: invite.id },
    data: { consumedAt: new Date() },
  });

  return { created, topic: invite.topic };
}

export async function addFounderQuotes(input: {
  workspaceId: string;
  topic?: string | null;
  quotes: string[];
  authorLabel?: string;
}) {
  const clean = [
    ...new Set(
      input.quotes
        .map((q) => q.replace(/\s+/g, ' ').trim())
        .filter((q) => q.length >= 12 && q.length <= 600),
    ),
  ].slice(0, 8);

  if (!clean.length) throw new Error('Pegá al menos una frase útil');

  const created = [];
  for (const quote of clean) {
    created.push(
      await prisma.founderVoiceNote.create({
        data: {
          workspaceId: input.workspaceId,
          topic: input.topic?.trim() || null,
          quote,
          authorLabel: input.authorLabel?.trim() || 'Founder',
          status: 'available',
        },
      }),
    );
  }
  return created;
}

export async function listFounderVoice(workspaceId: string) {
  const [notes, invites] = await Promise.all([
    prisma.founderVoiceNote.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.founderVoiceInvite.findMany({
      where: { workspaceId, expiresAt: { gt: new Date() }, consumedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return {
    notes,
    openInvites: invites.map((inv) => ({
      ...inv,
      url: `${frontendBaseUrl()}/voz/${inv.token}`,
    })),
    summary: {
      available: notes.filter((n) => n.status === 'available').length,
      used: notes.filter((n) => n.status === 'used').length,
    },
  };
}

/** Mira frases disponibles sin consumirlas. */
export async function peekFounderQuotes(input: {
  workspaceId: string;
  topic: string;
}): Promise<Array<{ id: string; quote: string; authorLabel: string }>> {
  const available = await prisma.founderVoiceNote.findMany({
    where: { workspaceId: input.workspaceId, status: 'available' },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  const matched = available.filter((n) => topicMatches(n.topic, input.topic));
  const pool = (matched.length ? matched : available).slice(0, MAX_QUOTES_PER_PIECE);
  return pool.map((n) => ({
    id: n.id,
    quote: n.quote,
    authorLabel: n.authorLabel,
  }));
}

export async function markFounderQuotesUsed(ids: string[], pieceId: string) {
  if (!ids.length) return;
  await prisma.founderVoiceNote.updateMany({
    where: { id: { in: ids }, status: 'available' },
    data: { status: 'used', usedInPieceId: pieceId },
  });
}

/** Inserta callouts “Voz del founder” sin bloquear si no hay frases. */
export function injectFounderVoiceCallouts(
  data: ArticleData,
  quotes: Array<{ quote: string; authorLabel: string }>,
): ArticleData {
  if (!quotes.length) return data;

  const sections = [...data.sections];
  const insertAt = Math.min(1, Math.max(0, sections.length - 1));

  for (let i = 0; i < quotes.length; i += 1) {
    const q = quotes[i];
    const callout = `Voz del founder (${q.authorLabel}): “${q.quote.replace(/^["“]|["”]$/g, '')}”`;
    const targetIndex = Math.min(insertAt + i, sections.length);
    if (sections[targetIndex] && !sections[targetIndex].callout) {
      sections[targetIndex] = { ...sections[targetIndex], callout };
    } else {
      sections.splice(targetIndex, 0, {
        heading: i === 0 ? 'Voz del founder' : undefined,
        callout,
      });
    }
  }

  return { ...data, sections };
}

export async function applyFounderVoiceToArticle(
  workspaceId: string,
  plan: StrategistPlan,
  data: ArticleData,
): Promise<{ article: ArticleData; quoteIds: string[]; injected: number }> {
  const quotes = await peekFounderQuotes({
    workspaceId,
    topic: plan.topic || plan.keyword,
  });
  if (!quotes.length) return { article: data, quoteIds: [], injected: 0 };
  return {
    article: injectFounderVoiceCallouts(data, quotes),
    quoteIds: quotes.map((q) => q.id),
    injected: quotes.length,
  };
}
