import { extractDomain } from './normalize-url';

const CONVERSATION_HOST_HINTS = [
  'reddit.com',
  'quora.com',
  'stackexchange.com',
  'stackoverflow.com',
  'superuser.com',
  'serverfault.com',
  'askubuntu.com',
  'groups.google.com',
  'discourse.',
  'forum.',
  'forums.',
  'community.',
  'comunidad.',
  'discusiones.',
  'discussions.',
  'answers.',
  'phpbb',
  'vbulletin',
  'xenforo',
];

const CONVERSATION_PATH_HINTS = [
  '/r/',
  '/questions/',
  '/question/',
  '/thread/',
  '/threads/',
  '/topic/',
  '/topics/',
  '/t/',
  '/foro/',
  '/foros/',
  '/forum/',
  '/forums/',
  '/discusion',
  '/discusión',
  '/discussion',
  '/comunidad/',
  '/community/',
  '/comments/',
  '/showthread',
  '/viewtopic',
];

const EXCLUDE_PATH_HINTS = [
  '/pricing',
  '/price',
  '/product',
  '/products',
  '/docs/',
  '/documentation',
  '/api/',
  '/login',
  '/signup',
  '/register',
  '/cart',
  '/checkout',
  '/privacy',
  '/terms',
  '/about',
  '/contacto',
  '/contact',
];

function isLikelyHomepage(pathname: string): boolean {
  return !pathname || pathname === '/' || pathname === '';
}

/**
 * Heurística: URL de foro / Q&A / comunidad, o tipos SERP de discusión.
 * Excluye homepages, docs y páginas de producto puras.
 */
export function isLikelyConversationUrl(
  url: string,
  resultType?: string | null,
): boolean {
  const type = (resultType ?? '').toString();
  if (type === 'discussions_and_forums' || type === 'questions_and_answers') {
    return true;
  }

  let pathname = '/';
  let host = '';
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    pathname = (u.pathname || '/').toLowerCase();
    host = extractDomain(url);
  } catch {
    return false;
  }

  if (isLikelyHomepage(pathname)) return false;
  if (EXCLUDE_PATH_HINTS.some((p) => pathname.includes(p))) return false;

  const hostHit = CONVERSATION_HOST_HINTS.some((h) => host.includes(h.replace(/\.$/, '')) || host.startsWith(h) || host.includes(h));
  const pathHit = CONVERSATION_PATH_HINTS.some((p) => pathname.includes(p));

  return hostHit || pathHit;
}
