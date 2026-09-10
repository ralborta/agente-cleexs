import type { GrowthVerifyStatus, Prisma } from '@prisma/client';
import { safeFetchPage, type SafeFetchResult } from '../../../url-reader/safe-fetch';
import { extractDomain, normalizeUrl } from './normalize-url';

export type ArticleContextForVerify = {
  title?: string | null;
  keyword?: string | null;
};

export type VerifyConversationPageInput = {
  url: string;
  articleContext?: ArticleContextForVerify;
  fetchPage?: (url: string) => Promise<SafeFetchResult>;
  timeoutMs?: number;
  maxBytes?: number;
};

export type VerifyConversationPageResult = {
  url: string;
  urlNormalized: string;
  domain: string;
  title: string | null;
  topic: string | null;
  questionText: string | null;
  audienceFitNotes: string | null;
  threadCreatedAt: Date | null;
  lastActivityAt: Date | null;
  threadCreatedAtKnown: boolean;
  lastActivityAtKnown: boolean;
  participationSignals: Prisma.InputJsonValue;
  allowsReplies: boolean | null;
  isClosed: boolean | null;
  isArchived: boolean | null;
  linkRulesNotes: string | null;
  evidenceSnippet: string | null;
  verifyStatus: GrowthVerifyStatus;
  verifiedAt: Date | null;
  verifyError: string | null;
};

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html: string): string | null {
  const og = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (og?.[1]) return stripTags(og[1]).slice(0, 300);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t?.[1]) return stripTags(t[1]).slice(0, 300);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return stripTags(h1[1]).slice(0, 300);
  return null;
}

function parseLooseDate(raw: string): Date | null {
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

function extractDates(html: string): {
  created: Date | null;
  createdKnown: boolean;
  activity: Date | null;
  activityKnown: boolean;
} {
  const times: Date[] = [];
  const timeTags = [...html.matchAll(/<time[^>]+datetime=["']([^"']+)["'][^>]*>/gi)];
  for (const m of timeTags) {
    const d = parseLooseDate(m[1]!);
    if (d) times.push(d);
  }
  const metaDates = [
    ...html.matchAll(
      /<meta[^>]+(?:property|name)=["'](?:article:published_time|article:modified_time|date|pubdate)["'][^>]+content=["']([^"']+)["']/gi,
    ),
  ];
  for (const m of metaDates) {
    const d = parseLooseDate(m[1]!);
    if (d) times.push(d);
  }

  if (!times.length) {
    return { created: null, createdKnown: false, activity: null, activityKnown: false };
  }
  times.sort((a, b) => a.getTime() - b.getTime());
  const created = times[0]!;
  const activity = times[times.length - 1]!;
  return {
    created,
    createdKnown: true,
    activity,
    activityKnown: true,
  };
}

function detectWalls(html: string, text: string): {
  closed: boolean;
  archived: boolean;
  loginWall: boolean;
} {
  const blob = `${html.slice(0, 50_000)} ${text.slice(0, 8_000)}`.toLowerCase();
  const closed =
    /\b(thread\s+closed|closed\s+thread|hilo\s+cerrado|this\s+topic\s+is\s+closed|locked\s+thread)\b/i.test(
      blob,
    );
  const archived =
    /\b(archived|archivado|read[\s-]only|solo\s+lectura)\b/i.test(blob) &&
    /\b(thread|topic|hilo|post)\b/i.test(blob);
  const loginWall =
    /\b(log\s*in\s+to\s+(view|continue|reply)|sign\s*in\s+to\s+(view|continue|reply)|debes\s+iniciar\s+sesi[oó]n|registrate\s+para\s+ver)\b/i.test(
      blob,
    ) ||
    (/password/i.test(blob) && /login|sign[\s-]?in|iniciar sesi/i.test(blob) && text.length < 400);
  return { closed, archived, loginWall };
}

function detectAllowsReplies(
  html: string,
  walls: { closed: boolean; archived: boolean; loginWall: boolean },
): boolean | null {
  if (walls.closed || walls.archived) return false;
  if (walls.loginWall) return null;
  const lower = html.toLowerCase();
  if (
    /<(textarea|form)[^>]*(reply|comment|respuesta|comentario)/i.test(html) ||
    /\badd\s+a\s+comment\b|\bpost\s+reply\b|\bresponder\b|\bescribir\s+respuesta\b/i.test(lower)
  ) {
    return true;
  }
  return null;
}

function extractQuestion(html: string, text: string, title: string | null): string | null {
  const qSelectors = [
    /itemprop=["']text["'][^>]*>([\s\S]*?)<\//i,
    /class=["'][^"']*(question|post-text|topic-body|entry-content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article|section)/i,
  ];
  for (const re of qSelectors) {
    const m = html.match(re);
    const raw = m?.[1] || m?.[2];
    if (raw) {
      const cleaned = stripTags(raw).slice(0, 1200);
      if (cleaned.length > 40) return cleaned;
    }
  }
  if (title && /\?|cómo|como|how|why|por qué/i.test(title)) return title;
  const first = text.slice(0, 500);
  return first.length > 40 ? first : title;
}

function linkRules(html: string, text: string): string | null {
  const blob = `${html} ${text}`.toLowerCase();
  const notes: string[] = [];
  if (/no\s+self[\s-]?promotion|no\s+spam|sin\s+spam|no\s+publicidad/i.test(blob)) {
    notes.push('posible restricción anti-autopromo / spam');
  }
  if (/no\s+links?|sin\s+enlaces|links?\s+not\s+allowed/i.test(blob)) {
    notes.push('posible prohibición de enlaces');
  }
  return notes.length ? notes.join('; ') : null;
}

/**
 * Verificación ligera de página de conversación.
 * HTML/texto externo = DATA; nunca se ejecuta como instrucción.
 * No inventa fechas: flags *Known separados.
 */
export async function verifyConversationPage(
  input: VerifyConversationPageInput,
): Promise<VerifyConversationPageResult> {
  const urlNormalized = normalizeUrl(input.url);
  const domain = extractDomain(urlNormalized || input.url);
  const base: VerifyConversationPageResult = {
    url: input.url,
    urlNormalized: urlNormalized || input.url,
    domain: domain || 'unknown',
    title: null,
    topic: null,
    questionText: null,
    audienceFitNotes: null,
    threadCreatedAt: null,
    lastActivityAt: null,
    threadCreatedAtKnown: false,
    lastActivityAtKnown: false,
    participationSignals: {},
    allowsReplies: null,
    isClosed: null,
    isArchived: null,
    linkRulesNotes: null,
    evidenceSnippet: null,
    verifyStatus: 'pending',
    verifiedAt: null,
    verifyError: null,
  };

  const fetcher =
    input.fetchPage ??
    ((u: string) =>
      safeFetchPage(u, {
        timeoutMs: input.timeoutMs,
        maxBytes: input.maxBytes,
      }));

  const fetched = await fetcher(input.url);
  if (!fetched.ok || !fetched.text) {
    return {
      ...base,
      url: fetched.finalUrl || input.url,
      urlNormalized: normalizeUrl(fetched.finalUrl || input.url) || base.urlNormalized,
      domain: extractDomain(fetched.finalUrl || input.url) || base.domain,
      verifyStatus: 'not_verifiable',
      verifyError: fetched.error ?? `HTTP ${fetched.status}`,
    };
  }

  // Contenido externo tratado solo como DATA para heurísticas (no como instrucciones).
  const html = fetched.text;
  const text = stripTags(html);
  const title = extractTitle(html);
  const dates = extractDates(html);
  const walls = detectWalls(html, text);
  const allowsReplies = detectAllowsReplies(html, walls);
  const questionText = extractQuestion(html, text, title);
  const evidenceSnippet = text.slice(0, 400) || null;

  if (walls.loginWall) {
    return {
      ...base,
      url: fetched.finalUrl,
      urlNormalized: normalizeUrl(fetched.finalUrl) || base.urlNormalized,
      domain: extractDomain(fetched.finalUrl) || base.domain,
      title,
      topic: title,
      questionText,
      evidenceSnippet,
      threadCreatedAt: dates.created,
      lastActivityAt: dates.activity,
      threadCreatedAtKnown: dates.createdKnown,
      lastActivityAtKnown: dates.activityKnown,
      isClosed: walls.closed,
      isArchived: walls.archived,
      allowsReplies: null,
      linkRulesNotes: linkRules(html, text),
      participationSignals: { loginWall: true, closed: walls.closed, archived: walls.archived },
      verifyStatus: 'not_verifiable',
      verifyError: 'login wall / contenido no accesible',
      verifiedAt: new Date(),
    };
  }

  const kw = input.articleContext?.keyword?.trim();
  const artTitle = input.articleContext?.title?.trim();
  let audienceFitNotes: string | null = null;
  if (kw || artTitle) {
    const hay = `${title ?? ''} ${questionText ?? ''} ${evidenceSnippet ?? ''}`.toLowerCase();
    const hits = [kw, artTitle].filter((x) => x && hay.includes(x.toLowerCase()));
    audienceFitNotes = hits.length
      ? `menciona: ${hits.join(', ')}`
      : 'sin overlap literal con keyword/título';
  }

  const looksLikeConversation =
    Boolean(questionText) ||
    /comment|reply|respuesta|forum|reddit|quora|thread|hilo|discus/i.test(html.slice(0, 20_000));

  if (!looksLikeConversation) {
    return {
      ...base,
      url: fetched.finalUrl,
      urlNormalized: normalizeUrl(fetched.finalUrl) || base.urlNormalized,
      domain: extractDomain(fetched.finalUrl) || base.domain,
      title,
      topic: title,
      questionText,
      evidenceSnippet,
      threadCreatedAt: dates.created,
      lastActivityAt: dates.activity,
      threadCreatedAtKnown: dates.createdKnown,
      lastActivityAtKnown: dates.activityKnown,
      isClosed: walls.closed,
      isArchived: walls.archived,
      allowsReplies,
      linkRulesNotes: linkRules(html, text),
      audienceFitNotes,
      participationSignals: { looksLikeConversation: false },
      verifyStatus: 'excluded',
      verifyError: 'no parece conversación/foro',
      verifiedAt: new Date(),
    };
  }

  return {
    ...base,
    url: fetched.finalUrl,
    urlNormalized: normalizeUrl(fetched.finalUrl) || base.urlNormalized,
    domain: extractDomain(fetched.finalUrl) || base.domain,
    title,
    topic: title,
    questionText,
    audienceFitNotes,
    threadCreatedAt: dates.created,
    lastActivityAt: dates.activity,
    threadCreatedAtKnown: dates.createdKnown,
    lastActivityAtKnown: dates.activityKnown,
    participationSignals: {
      closed: walls.closed,
      archived: walls.archived,
      loginWall: false,
      contentBytes: html.length,
    },
    allowsReplies,
    isClosed: walls.closed,
    isArchived: walls.archived,
    linkRulesNotes: linkRules(html, text),
    evidenceSnippet,
    verifyStatus: 'verified',
    verifiedAt: new Date(),
    verifyError: null,
  };
}
