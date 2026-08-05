/**
 * Sprint 5.1 — fundaciones técnicas SEO/AEO del sitio:
 * verificar sitemap, auditar robots.txt (solo lectura), generar llms.txt.
 */
import { prisma } from '../prisma';
import { resolveBrandKit } from '../branding/brand-kit';
import {
  isWordPressConfigured,
  resolveWordPressConfig,
  upsertWordPressPage,
  type WordPressConfig,
} from './wordpress';

export type FoundationsCheck = {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'pending' | 'error';
  detail: string;
  url?: string;
};

export type RobotsSuggestion = {
  id: string;
  severity: 'info' | 'warning';
  message: string;
};

export type SeoFoundationsReport = {
  siteUrl: string | null;
  checks: FoundationsCheck[];
  robots: {
    found: boolean;
    rawPreview: string | null;
    sitemapLines: string[];
    suggestions: RobotsSuggestion[];
  };
  llms: {
    generated: string;
    pageUrl: string | null;
    rootUrl: string | null;
    rootReachable: boolean;
  };
};

async function probeUrl(
  url: string,
): Promise<{ ok: boolean; status: number; contentType: string; bytes: number; snippet: string }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'CleexsTeoSeoFoundations/1.0' },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || '';
    return {
      ok: res.ok,
      status: res.status,
      contentType,
      bytes: buf.length,
      snippet: buf.toString('utf8', 0, 400),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      contentType: '',
      bytes: 0,
      snippet: err instanceof Error ? err.message : 'fetch failed',
    };
  }
}

function sitemapCandidates(baseUrl: string): string[] {
  const root = baseUrl.replace(/\/$/, '');
  return [
    `${root}/wp-sitemap.xml`,
    `${root}/sitemap_index.xml`,
    `${root}/sitemap.xml`,
    `${root}/sitemap_index.xml.gz`,
  ];
}

function analyzeRobots(raw: string, siteUrl: string): {
  sitemapLines: string[];
  suggestions: RobotsSuggestion[];
} {
  const lines = raw.split(/\r?\n/);
  const sitemapLines = lines
    .map((l) => l.trim())
    .filter((l) => /^sitemap:\s*/i.test(l))
    .map((l) => l.replace(/^sitemap:\s*/i, '').trim())
    .filter(Boolean);

  const suggestions: RobotsSuggestion[] = [];
  const lower = raw.toLowerCase();

  if (!sitemapLines.length) {
    suggestions.push({
      id: 'robots-sitemap',
      severity: 'warning',
      message: `Agregá una línea Sitemap: ${siteUrl.replace(/\/$/, '')}/wp-sitemap.xml (o el sitemap de Rank Math).`,
    });
  }

  if (/disallow:\s*\/articulos/i.test(raw)) {
    suggestions.push({
      id: 'block-articulos',
      severity: 'warning',
      message: 'robots.txt bloquea /articulos/ — eso impide indexar el blog de Teo.',
    });
  }

  const aiBots = ['gptbot', 'claudebot', 'google-extended', 'anthropic-ai', 'ccbot'];
  const blockedAi = aiBots.filter((bot) => {
    const re = new RegExp(`user-agent:\\s*${bot}[\\s\\S]*?disallow:\\s*/`, 'i');
    return re.test(raw) || (lower.includes(`user-agent: ${bot}`) && /disallow:\s*\/\s*$/im.test(raw));
  });
  if (blockedAi.length) {
    suggestions.push({
      id: 'block-ai',
      severity: 'info',
      message: `Hay reglas que bloquean bots de IA (${blockedAi.join(', ')}). Solo mantenelas si es a propósito; para AEO suele convenir permitirlas.`,
    });
  }

  if (/disallow:\s*\/\s*$/im.test(raw) && /user-agent:\s*\*/i.test(raw)) {
    // Check if * blocks everything - naive
    const uaStar = raw.match(/user-agent:\s*\*([\s\S]*?)(?=user-agent:|$)/i);
    if (uaStar && /disallow:\s*\/\s*$/im.test(uaStar[1]) && !/allow:\s*\//i.test(uaStar[1])) {
      suggestions.push({
        id: 'block-all',
        severity: 'warning',
        message: 'User-agent * parece Disallow: / — el sitio puede estar cerrado a crawlers.',
      });
    }
  }

  if (!suggestions.length) {
    suggestions.push({
      id: 'robots-ok',
      severity: 'info',
      message: 'No se detectaron bloqueos obvios contra /articulos/ ni ausencia de Sitemap.',
    });
  }

  return { sitemapLines, suggestions };
}

export async function buildLlmsTxt(workspaceSlug: string): Promise<string> {
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) throw new Error('Workspace no encontrado');

  const agentConfig = await prisma.agentConfig.findFirst({
    where: { workspaceId: workspace.id, agent: { slug: 'teo' } },
  });
  const branding = resolveBrandKit(agentConfig?.branding, workspace.name);
  const brand = branding.brandName || workspace.name;
  const wp = resolveWordPressConfig(workspaceSlug);
  const site = (wp?.baseUrl || 'https://cleexs.net').replace(/\/$/, '');
  const cta = branding.cta?.url || `${site}/`;

  const pubs = await prisma.publication.findMany({
    where: { workspaceId: workspace.id, url: { not: null } },
    orderBy: { publishedAt: 'desc' },
    take: 25,
    include: {
      piece: { select: { title: true, type: true, status: true, keyword: true } },
    },
  });

  const published = pubs.filter((p) => p.piece.status === 'published' || p.piece.status === 'refresh_needed');

  const lines: string[] = [
    `# ${brand}`,
    `> ${branding.cta?.body || `${brand} ayuda a PyMEs a medir y mejorar su visibilidad en Google y motores de IA.`}`,
    '',
    `Sitio: ${site}`,
    `Blog: ${site}/articulos/`,
    '',
    '## Producto',
    '',
    `- Diagnóstico de visibilidad: ${cta}`,
    `- Contenido editorial SEO/AEO: ${site}/articulos/`,
    '',
    '## Artículos recientes',
    '',
  ];

  if (!published.length) {
    lines.push('- (Todavía no hay publicaciones indexables en Teo)');
  } else {
    for (const pub of published) {
      const title = pub.piece.title;
      const url = pub.url!;
      const kw = pub.piece.keyword ? ` — keyword: ${pub.piece.keyword}` : '';
      lines.push(`- [${title}](${url})${kw}`);
    }
  }

  lines.push(
    '',
    '## Contacto / cita',
    '',
    `- Preferí citar fuentes canónicas de ${site}/articulos/`,
    `- Marca: ${brand}`,
    '',
    '## Optional',
    '',
    `- Este archivo lo mantiene Teo (agente de contenido Cleexs).`,
  );

  return lines.join('\n').trim() + '\n';
}

export async function auditSeoFoundations(workspaceSlug: string): Promise<SeoFoundationsReport> {
  const config = resolveWordPressConfig(workspaceSlug);
  const siteUrl = config?.baseUrl?.replace(/\/$/, '') || null;
  const checks: FoundationsCheck[] = [];

  if (!isWordPressConfigured(config) || !siteUrl) {
    const llms = await buildLlmsTxt(workspaceSlug).catch(() => '# Cleexs\n');
    return {
      siteUrl: null,
      checks: [
        {
          id: 'wp-config',
          label: 'WordPress configurado',
          status: 'pending',
          detail: 'Configurá WORDPRESS_URL para auditar sitemap/robots/llms del sitio.',
        },
      ],
      robots: { found: false, rawPreview: null, sitemapLines: [], suggestions: [] },
      llms: {
        generated: llms,
        pageUrl: null,
        rootUrl: null,
        rootReachable: false,
      },
    };
  }

  // --- Sitemap ---
  let sitemapOk: FoundationsCheck | null = null;
  for (const url of sitemapCandidates(siteUrl)) {
    const probe = await probeUrl(url);
    const looksXml =
      probe.contentType.includes('xml') ||
      probe.snippet.includes('<urlset') ||
      probe.snippet.includes('<sitemapindex') ||
      probe.snippet.includes('<?xml');
    if (probe.ok && looksXml && probe.bytes > 40) {
      sitemapOk = {
        id: 'sitemap',
        label: 'Sitemap',
        status: 'ok',
        detail: `OK ${probe.status} · ${probe.bytes} bytes`,
        url,
      };
      break;
    }
  }
  checks.push(
    sitemapOk ?? {
      id: 'sitemap',
      label: 'Sitemap',
      status: 'warning',
      detail:
        'No se encontró un sitemap XML público en rutas habituales (wp-sitemap.xml / sitemap_index.xml). Revisá Rank Math o enlaces permanentes.',
      url: `${siteUrl}/wp-sitemap.xml`,
    },
  );

  // --- robots.txt ---
  const robotsUrl = `${siteUrl}/robots.txt`;
  const robotsProbe = await probeUrl(robotsUrl);
  let robotsRaw: string | null = null;
  let sitemapLines: string[] = [];
  let suggestions: RobotsSuggestion[] = [];

  if (robotsProbe.ok && robotsProbe.bytes > 0) {
    robotsRaw = (await fetch(robotsUrl, { signal: AbortSignal.timeout(15_000) })
      .then((r) => r.text())
      .catch(() => robotsProbe.snippet)) as string;
    const analyzed = analyzeRobots(robotsRaw, siteUrl);
    sitemapLines = analyzed.sitemapLines;
    suggestions = analyzed.suggestions;
    checks.push({
      id: 'robots',
      label: 'robots.txt',
      status: suggestions.some((s) => s.severity === 'warning') ? 'warning' : 'ok',
      detail: `Encontrado (${robotsRaw.length} chars)${
        sitemapLines.length ? ` · ${sitemapLines.length} Sitemap:` : ''
      }`,
      url: robotsUrl,
    });
  } else {
    suggestions = [
      {
        id: 'robots-missing',
        severity: 'warning',
        message: 'No hay robots.txt accesible. WordPress suele generarlo; verificá el hosting.',
      },
    ];
    checks.push({
      id: 'robots',
      label: 'robots.txt',
      status: 'warning',
      detail: `No accesible (HTTP ${robotsProbe.status || 'error'})`,
      url: robotsUrl,
    });
  }

  // --- llms.txt ---
  const generated = await buildLlmsTxt(workspaceSlug);
  const rootLlms = `${siteUrl}/llms.txt`;
  const altLlms = `${siteUrl}/llm.txt`;
  const pageLlms = `${siteUrl}/llms-txt/`;
  const rootProbe = await probeUrl(rootLlms);
  const altProbe = await probeUrl(altLlms);
  const pageProbe = await probeUrl(pageLlms);

  const looksPlainLlms = (p: { ok: boolean; bytes: number; snippet: string }) =>
    p.ok && p.bytes > 40 && !/<html/i.test(p.snippet) && !/<!DOCTYPE/i.test(p.snippet);

  const llmsRootOk = looksPlainLlms(rootProbe) || looksPlainLlms(altProbe);

  checks.push({
    id: 'llms-root',
    label: 'llms.txt en raíz',
    status: llmsRootOk ? 'ok' : 'pending',
    detail: llmsRootOk
      ? 'Archivo plain-text accesible en la raíz del sitio'
      : 'Todavía no responde /llms.txt. Publicá el contenido y activá el mu-plugin Cleexs (docs/wordpress).',
    url: rootLlms,
  });

  checks.push({
    id: 'llms-page',
    label: 'Página WP llms-txt',
    status: pageProbe.ok ? 'ok' : 'pending',
    detail: pageProbe.ok
      ? 'Existe la página /llms-txt/ (fuente para el mu-plugin)'
      : 'Aún no hay página. Usá “Publicar llms.txt” para crearla/actualizarla.',
    url: pageLlms,
  });

  return {
    siteUrl,
    checks,
    robots: {
      found: Boolean(robotsRaw),
      rawPreview: robotsRaw ? robotsRaw.slice(0, 1200) : null,
      sitemapLines,
      suggestions,
    },
    llms: {
      generated,
      pageUrl: pageProbe.ok ? pageLlms : null,
      rootUrl: rootLlms,
      rootReachable: llmsRootOk,
    },
  };
}

export async function publishLlmsTxt(workspaceSlug: string): Promise<{
  content: string;
  page: { id: number; url: string; slug: string };
}> {
  const config = resolveWordPressConfig(workspaceSlug);
  if (!isWordPressConfigured(config)) {
    throw new Error('WordPress no configurado');
  }
  const content = await buildLlmsTxt(workspaceSlug);
  // Contenido plain: el mu-plugin lo sirve como text/plain en /llms.txt
  const page = await upsertWordPressPage(config as WordPressConfig, {
    slug: 'llms-txt',
    title: 'llms.txt',
    content: `<pre class="cleexs-llms">${escapeHtml(content)}</pre>`,
    status: 'publish',
  });
  return {
    content,
    page: {
      id: page.id,
      url: page.link,
      slug: page.slug,
    },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
