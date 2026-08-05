/**
 * Sprint 2.3 — imagen destacada por artículo.
 * 3 templates SVG (siempre) + DALL·E opcional si hay OPENAI_API_KEY.
 */
import type { BrandKit } from '@agente/shared';

export type CoverTemplateId = 'editorial' | 'signal' | 'grid';

export type FeaturedCover = {
  template: CoverTemplateId;
  alt: string;
  /** data:image/svg+xml;base64... o URL https (DALL·E / WP) */
  url: string;
  source: 'svg' | 'dalle' | 'wordpress';
  prompt?: string;
};

const TEMPLATES: CoverTemplateId[] = ['editorial', 'signal', 'grid'];

export function pickCoverTemplate(pieceType: string, seed: string): CoverTemplateId {
  if (pieceType === 'case_study' || pieceType === 'landing') return 'signal';
  if (pieceType === 'faq' || pieceType === 'checklist') return 'grid';
  if (pieceType === 'pillar' || pieceType === 'comparison') return 'editorial';
  const idx = Math.abs(hash(seed)) % TEMPLATES.length;
  return TEMPLATES[idx];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapTitle(title: string, maxLen = 42): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxLen && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= 3) break;
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < 3) lines.push(cur);
  return lines.slice(0, 3);
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/** Template editorial: hero oscuro con acento de marca. */
function buildEditorialSvg(input: {
  title: string;
  kicker: string;
  brand: string;
  primary: string;
}): string {
  const lines = wrapTitle(input.title, 36);
  const titleTspans = lines
    .map(
      (line, i) =>
        `<tspan x="64" dy="${i === 0 ? 0 : 52}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#04182b"/>
      <stop offset="55%" stop-color="#061527"/>
      <stop offset="100%" stop-color="#0a2340"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="15%" r="45%">
      <stop offset="0%" stop-color="${escapeXml(input.primary)}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${escapeXml(input.primary)}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="0" y="0" width="12" height="630" fill="${escapeXml(input.primary)}"/>
  <text x="64" y="88" fill="#7aa5f5" font-family="Georgia, serif" font-size="22" letter-spacing="4" font-weight="700">${escapeXml(input.kicker.toUpperCase().slice(0, 48))}</text>
  <text x="64" y="220" fill="#ffffff" font-family="Georgia, serif" font-size="46" font-weight="700">${titleTspans}</text>
  <text x="64" y="560" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="22">${escapeXml(input.brand)}</text>
</svg>`;
}

/** Template signal: bloques geométricos + tipografía fuerte. */
function buildSignalSvg(input: {
  title: string;
  kicker: string;
  brand: string;
  primary: string;
}): string {
  const lines = wrapTitle(input.title, 34);
  const titleTspans = lines
    .map(
      (line, i) =>
        `<tspan x="72" dy="${i === 0 ? 0 : 48}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0f172a"/>
  <rect x="720" y="0" width="480" height="630" fill="${escapeXml(input.primary)}" opacity="0.92"/>
  <circle cx="960" cy="180" r="120" fill="#ffffff" opacity="0.12"/>
  <circle cx="1040" cy="420" r="80" fill="#ffffff" opacity="0.08"/>
  <text x="72" y="100" fill="${escapeXml(input.primary)}" font-family="system-ui,sans-serif" font-size="20" letter-spacing="3" font-weight="700">${escapeXml(input.kicker.toUpperCase().slice(0, 40))}</text>
  <text x="72" y="240" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="44" font-weight="800">${titleTspans}</text>
  <text x="72" y="560" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="20">${escapeXml(input.brand)} · Insights</text>
  <text x="800" y="320" fill="#ffffff" font-family="system-ui,sans-serif" font-size="28" font-weight="700" opacity="0.9">SEO + AEO</text>
</svg>`;
}

/** Template grid: tarjeta clara con marco de marca. */
function buildGridSvg(input: {
  title: string;
  kicker: string;
  brand: string;
  primary: string;
}): string {
  const lines = wrapTitle(input.title, 38);
  const titleTspans = lines
    .map(
      (line, i) =>
        `<tspan x="80" dy="${i === 0 ? 0 : 46}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f1f5f9"/>
  <rect x="40" y="40" width="1120" height="550" rx="24" fill="#ffffff" stroke="${escapeXml(input.primary)}" stroke-width="3"/>
  <rect x="40" y="40" width="1120" height="18" rx="8" fill="${escapeXml(input.primary)}"/>
  <text x="80" y="130" fill="${escapeXml(input.primary)}" font-family="system-ui,sans-serif" font-size="18" letter-spacing="2" font-weight="700">${escapeXml(input.kicker.toUpperCase().slice(0, 48))}</text>
  <text x="80" y="250" fill="#0f172a" font-family="Georgia, serif" font-size="42" font-weight="700">${titleTspans}</text>
  <line x1="80" y1="480" x2="400" y2="480" stroke="${escapeXml(input.primary)}" stroke-width="4"/>
  <text x="80" y="530" fill="#64748b" font-family="system-ui,sans-serif" font-size="20">${escapeXml(input.brand)}</text>
</svg>`;
}

export function buildSvgCover(input: {
  title: string;
  kicker?: string;
  pieceType: string;
  branding?: BrandKit | null;
  template?: CoverTemplateId;
}): FeaturedCover {
  const brand = input.branding?.brandName?.trim() || 'Cleexs';
  const primary = input.branding?.primaryColor || '#2563EB';
  const kicker = (input.kicker || input.pieceType || 'Guía').slice(0, 48);
  const template =
    input.template || pickCoverTemplate(input.pieceType, input.title + input.pieceType);

  const payload = { title: input.title, kicker, brand, primary };
  let svg: string;
  if (template === 'signal') svg = buildSignalSvg(payload);
  else if (template === 'grid') svg = buildGridSvg(payload);
  else svg = buildEditorialSvg(payload);

  return {
    template,
    alt: `Portada: ${input.title}`,
    url: svgToDataUrl(svg),
    source: 'svg',
  };
}

export function coverSvgBuffer(cover: FeaturedCover): Buffer | null {
  if (!cover.url.startsWith('data:image/svg+xml;base64,')) return null;
  const b64 = cover.url.slice('data:image/svg+xml;base64,'.length);
  return Buffer.from(b64, 'base64');
}

/** Intenta DALL·E; si falla, el caller usa SVG. */
export async function tryGenerateDalleCover(input: {
  title: string;
  topic: string;
  pieceType: string;
  brand?: string;
}): Promise<FeaturedCover | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  if (process.env.DISABLE_DALLE_COVER === 'true') return null;

  const brand = input.brand || 'Cleexs';
  const prompt = `Editorial blog cover illustration, flat modern design, no text, no logos, no watermarks. Theme: ${input.topic}. Style: clean geometric abstract for B2B SaaS / SEO content, blue and slate palette, professional LATAM tech magazine feel. Piece type mood: ${input.pieceType}. Brand vibe: ${brand}.`;

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL?.trim() || 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      console.warn('[media-cover] DALL·E error', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as { data?: Array<{ url?: string }> };
    const url = data.data?.[0]?.url;
    if (!url) return null;
    return {
      template: pickCoverTemplate(input.pieceType, input.title),
      alt: `Portada: ${input.title}`,
      url,
      source: 'dalle',
      prompt,
    };
  } catch (err) {
    console.warn('[media-cover] DALL·E falló:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function generateFeaturedCover(input: {
  title: string;
  topic: string;
  pieceType: string;
  kicker?: string;
  branding?: BrandKit | null;
}): Promise<FeaturedCover> {
  const svg = buildSvgCover({
    title: input.title,
    kicker: input.kicker,
    pieceType: input.pieceType,
    branding: input.branding,
  });

  const dalle = await tryGenerateDalleCover({
    title: input.title,
    topic: input.topic,
    pieceType: input.pieceType,
    brand: input.branding?.brandName,
  });

  // Preferimos SVG estable en el HTML; DALL·E se usa sobre todo para featured_media WP.
  // Si hay DALL·E, lo devolvemos como cover principal (más “imagen real”).
  return dalle ?? svg;
}

export const COVER_TEMPLATE_LABELS: Record<CoverTemplateId, string> = {
  editorial: 'Editorial oscuro',
  signal: 'Señal / geométrico',
  grid: 'Grid claro',
};
