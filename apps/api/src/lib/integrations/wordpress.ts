import {
  buildWordPressSeoMetaFields,
  buildSeoMetaPayload,
  hasSeoPluginConfigured,
  looksLikeSeoHeadline,
  WP_HEADER_HOME_NAV_TITLE,
  WP_HEADER_SITE_NAME,
  type WordPressSeoInput,
} from './wordpress-seo';

export type WordPressConfig = {
  baseUrl: string;
  username: string;
  appPassword: string;
  defaultCategoryId?: number;
  /** draft | publish | pending */
  approvalPostStatus?: 'draft' | 'publish' | 'pending';
  /** Nombre visible del autor en WordPress (usuario WP debe coincidir) */
  authorDisplayName?: string;
};

const DEFAULT_WP_AUTHOR_NAME = 'Teo';

export type WordPressPostPayload = {
  title: string;
  content: string;
  excerpt?: string;
  status?: 'draft' | 'publish' | 'pending' | 'private';
  slug?: string;
  categories?: number[];
  featuredMediaId?: number;
  seoMeta?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    focusKeyword?: string | null;
  };
};

export type WordPressPostResponse = {
  id: number;
  link: string;
  status: string;
  slug: string;
  title: { rendered: string };
  permalink_template?: string;
};

export function isWordPressConfigured(config: WordPressConfig | null): config is WordPressConfig {
  return Boolean(config?.baseUrl && config?.username && config?.appPassword);
}

/** Resuelve credenciales WP por workspace (env por ahora; luego Integration en DB). */
export function resolveWordPressConfig(workspaceSlug: string): WordPressConfig | null {
  const prefix = workspaceSlug.toUpperCase().replace(/-/g, '_');

  const baseUrl =
    process.env[`WP_${prefix}_URL`] ||
    (workspaceSlug === 'cleexs' ? process.env.WORDPRESS_URL : undefined);
  const username =
    process.env[`WP_${prefix}_USER`] ||
    (workspaceSlug === 'cleexs' ? process.env.WORDPRESS_USERNAME : undefined);
  const appPassword =
    process.env[`WP_${prefix}_APP_PASSWORD`] ||
    (workspaceSlug === 'cleexs' ? process.env.WORDPRESS_APP_PASSWORD : undefined);

  if (!baseUrl || !username || !appPassword) {
    return null;
  }

  const defaultCategoryId = Number(
    process.env[`WP_${prefix}_CATEGORY_ID`] ||
      (workspaceSlug === 'cleexs' ? process.env.WORDPRESS_CATEGORY_ID : undefined),
  );

  const approvalPostStatus = (process.env[`WP_${prefix}_APPROVAL_STATUS`] ||
    process.env.WORDPRESS_APPROVAL_STATUS ||
    'draft') as WordPressConfig['approvalPostStatus'];

  const authorDisplayName =
    process.env[`WP_${prefix}_AUTHOR_NAME`] ||
    (workspaceSlug === 'cleexs' ? process.env.WORDPRESS_AUTHOR_NAME : undefined) ||
    DEFAULT_WP_AUTHOR_NAME;

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    username,
    appPassword,
    defaultCategoryId: Number.isFinite(defaultCategoryId) && defaultCategoryId > 0
      ? defaultCategoryId
      : undefined,
    approvalPostStatus: approvalPostStatus ?? 'draft',
    authorDisplayName,
  };
}

export function markdownToHtml(markdown: string): string {
  return markdown
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith('### ')) {
        return `<h3>${escapeHtml(block.slice(4))}</h3>`;
      }
      if (block.startsWith('## ')) {
        return `<h2>${escapeHtml(block.slice(3))}</h2>`;
      }
      if (block.startsWith('# ')) {
        return `<h1>${escapeHtml(block.slice(2))}</h1>`;
      }
      if (block === '---') {
        return '<hr />';
      }
      if (block.startsWith('*') && block.endsWith('*')) {
        return `<p><em>${escapeHtml(block.slice(1, -1))}</em></p>`;
      }
      return `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function basicAuthHeader(username: string, appPassword: string) {
  const token = Buffer.from(`${username}:${appPassword.replace(/\s/g, '')}`).toString('base64');
  return `Basic ${token}`;
}

async function wpFetch<T>(
  config: WordPressConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${config.baseUrl}/wp-json/wp/v2${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: basicAuthHeader(config.username, config.appPassword),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`WordPress ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

export async function testWordPressConnection(config: WordPressConfig) {
  const user = await wpFetch<{ name: string; slug: string; roles?: string[] }>(
    config,
    '/users/me?context=edit',
  );
  return {
    ok: true,
    site: config.baseUrl,
    user: user.name,
    slug: user.slug,
    roles: user.roles ?? [],
  };
}

export async function createWordPressPost(
  config: WordPressConfig,
  payload: WordPressPostPayload,
): Promise<WordPressPostResponse> {
  const body: Record<string, unknown> = {
    title: payload.title,
    content: payload.content,
    status: payload.status ?? config.approvalPostStatus ?? 'draft',
    // Artículos de Teo: sin comentarios ni pings en el post público
    comment_status: 'closed',
    ping_status: 'closed',
    ...buildWordPressSeoMetaFields({
      metaTitle: payload.seoMeta?.metaTitle,
      metaDescription: payload.seoMeta?.metaDescription ?? payload.excerpt,
      focusKeyword: payload.seoMeta?.focusKeyword,
    }),
  };

  if (payload.excerpt) body.excerpt = payload.excerpt;
  if (payload.slug) body.slug = payload.slug;
  if (payload.featuredMediaId) body.featured_media = payload.featuredMediaId;
  if (payload.categories?.length) {
    body.categories = payload.categories;
  } else if (config.defaultCategoryId) {
    body.categories = [config.defaultCategoryId];
  }

  return wpFetch<WordPressPostResponse>(config, '/posts', {
    method: 'POST',
    body: JSON.stringify(body),
  }).then(async (post) => {
    if (payload.seoMeta && hasSeoPluginConfigured()) {
      await syncWordPressSeoMeta(config, post.id, payload.seoMeta, payload.excerpt);
    }
    return post;
  });
}

/** Refuerza meta SEO tras crear/actualizar (Rank Math requiere mu-plugin en WP). */
export async function syncWordPressSeoMeta(
  config: WordPressConfig,
  postId: number,
  seoMeta: NonNullable<WordPressPostPayload['seoMeta']>,
  excerpt?: string,
): Promise<void> {
  const metaFields = buildSeoMetaPayload({
    metaTitle: seoMeta.metaTitle,
    metaDescription: seoMeta.metaDescription ?? excerpt,
    focusKeyword: seoMeta.focusKeyword,
  });
  if (Object.keys(metaFields).length === 0) return;

  try {
    await wpFetch(config, `/posts/${postId}`, {
      method: 'POST',
      body: JSON.stringify({ meta: metaFields }),
    });
  } catch (err) {
    console.warn('[wordpress] No se pudo sincronizar meta SEO:', err);
  }
}

/** Base del sitio WP del workspace, o fallback Cleexs. */
export function resolveSiteBaseUrl(workspaceSlug: string): string {
  const config = resolveWordPressConfig(workspaceSlug);
  if (config?.baseUrl) return config.baseUrl.replace(/\/$/, '');
  if (workspaceSlug === 'empleados') return 'https://empliados.net';
  return 'https://cleexs.net';
}

/** Canonical / URL pública de artículo: {site}/articulos/{slug}/ */
export function buildArticleCanonicalUrl(siteBase: string, slug: string): string {
  const base = siteBase.replace(/\/$/, '') || 'https://cleexs.net';
  const clean = slug.replace(/^\/+|\/+$/g, '');
  return `${base}/articulos/${clean}/`;
}

/** URL pública legible ({site}/articulos/slug/), no el preview ?p= de borradores. */
export function resolveWordPressPublicUrl(
  config: WordPressConfig,
  wpPost: Pick<WordPressPostResponse, 'link' | 'slug' | 'permalink_template'>,
  slugHint?: string | null,
  canonicalHint?: string | null,
): string {
  const canonical = canonicalHint?.trim();
  if (canonical && canonical.includes('/articulos/')) {
    return canonical.endsWith('/') ? canonical : `${canonical}/`;
  }

  const link = wpPost.link?.trim() ?? '';
  if (link.includes('/articulos/') && !link.includes('?p=')) {
    return link.endsWith('/') ? link : `${link}/`;
  }

  const slug = (slugHint ?? wpPost.slug)?.replace(/^\/+|\/+$/g, '');
  if (slug) {
    const template = wpPost.permalink_template?.trim();
    if (template && template.includes('%postname%')) {
      const built = template.replace('%postname%', slug);
      return built.endsWith('/') ? built : `${built}/`;
    }
    return `${config.baseUrl}/articulos/${slug}/`;
  }

  return link || config.baseUrl;
}

export async function updateWordPressPost(
  config: WordPressConfig,
  postId: number,
  payload: Partial<WordPressPostPayload>,
): Promise<WordPressPostResponse> {
  const body: Record<string, unknown> = { ...payload };
  if (payload.featuredMediaId) {
    body.featured_media = payload.featuredMediaId;
    delete body.featuredMediaId;
  }
  if (payload.seoMeta) {
    Object.assign(
      body,
      buildWordPressSeoMetaFields({
        metaTitle: payload.seoMeta.metaTitle,
        metaDescription: payload.seoMeta.metaDescription ?? payload.excerpt,
        focusKeyword: payload.seoMeta.focusKeyword,
      }),
    );
    delete body.seoMeta;
  }
  const seoMetaForSync = payload.seoMeta;
  return wpFetch<WordPressPostResponse>(config, `/posts/${postId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  }).then(async (post) => {
    if (seoMetaForSync && hasSeoPluginConfigured()) {
      await syncWordPressSeoMeta(config, postId, seoMetaForSync, payload.excerpt);
    }
    return post;
  });
}

/** Mueve un post a la papelera de WordPress (recuperable desde WP). */
export async function trashWordPressPost(
  config: WordPressConfig,
  postId: number,
): Promise<WordPressPostResponse> {
  return wpFetch<WordPressPostResponse>(config, `/posts/${postId}`, {
    method: 'POST',
    body: JSON.stringify({ status: 'trash' }),
  });
}

/** Sube un archivo a la biblioteca de medios de WP. */
export async function uploadWordPressMedia(
  config: WordPressConfig,
  input: {
    buffer: Buffer;
    filename: string;
    contentType: string;
    alt?: string;
    title?: string;
  },
): Promise<{ id: number; sourceUrl: string }> {
  const url = `${config.baseUrl}/wp-json/wp/v2/media`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(config.username, config.appPassword),
      'Content-Disposition': `attachment; filename="${input.filename.replace(/"/g, '')}"`,
      'Content-Type': input.contentType,
      Accept: 'application/json',
    },
    body: input.buffer,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`WordPress media ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id: number; source_url?: string };
  if (input.alt || input.title) {
    try {
      await wpFetch(config, `/media/${data.id}`, {
        method: 'POST',
        body: JSON.stringify({
          alt_text: input.alt ?? '',
          title: input.title ?? input.filename,
        }),
      });
    } catch {
      // no crítico
    }
  }

  return { id: data.id, sourceUrl: data.source_url ?? '' };
}

/**
 * Resuelve bytes de una portada (SVG/PNG data-URI o URL remota).
 */
export async function resolveCoverUploadBuffer(coverUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
  ext: string;
} | null> {
  const dataUri = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(coverUrl);
  if (dataUri) {
    const contentType = dataUri[1].toLowerCase();
    const buffer = Buffer.from(dataUri[2], 'base64');
    const ext =
      contentType.includes('svg')
        ? 'svg'
        : contentType.includes('jpeg') || contentType.includes('jpg')
          ? 'jpg'
          : contentType.includes('webp')
            ? 'webp'
            : 'png';
    return { buffer, contentType, ext };
  }
  if (coverUrl.startsWith('https://')) {
    const res = await fetch(coverUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type')?.split(';')[0] || 'image/png';
    const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png';
    return { buffer, contentType, ext };
  }
  return null;
}

export type PieceContent = {
  markdown?: string;
  html?: string;
  excerpt?: string;
};

export function pieceContentToHtml(content: PieceContent | null | undefined): string {
  if (!content) return '<p></p>';
  if (content.html) return content.html;
  if (content.markdown) return markdownToHtml(content.markdown);
  return '<p></p>';
}

type WpCategory = { id: number; name: string; slug: string };

export async function findOrCreateCategory(
  config: WordPressConfig,
  name: string,
): Promise<number> {
  const search = encodeURIComponent(name);
  const existing = await wpFetch<WpCategory[]>(config, `/categories?search=${search}&per_page=20`);
  const match = existing.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (match) return match.id;

  const created = await wpFetch<WpCategory>(config, '/categories', {
    method: 'POST',
    body: JSON.stringify({ name, slug: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-') }),
  });
  return created.id;
}

type WpPage = {
  id: number;
  link: string;
  status: string;
  slug: string;
  title: { rendered: string; raw?: string };
};

type WpSettings = {
  title?: string;
  description?: string;
  page_on_front?: number;
  show_on_front?: string;
};

function rawPageTitle(page: WpPage): string {
  return (page.title.raw ?? page.title.rendered ?? '').trim();
}

export type WordPressHeaderIdentity = {
  siteTitle: string;
  homePageTitle: string;
  homePageId: number | null;
  ok: boolean;
  detail: string;
};

async function readWordPressSettings(config: WordPressConfig): Promise<WpSettings> {
  return wpFetch<WpSettings>(config, '/settings');
}

async function readFrontPage(
  config: WordPressConfig,
  settings?: WpSettings,
): Promise<{ settings: WpSettings; page: WpPage | null }> {
  const resolved = settings ?? (await readWordPressSettings(config));
  const homeId = Number(resolved.page_on_front) || 0;
  if (homeId <= 0) {
    return { settings: resolved, page: null };
  }
  const page = await wpFetch<WpPage>(config, `/pages/${homeId}?context=edit`);
  return { settings: resolved, page };
}

/**
 * Astra muestra logo + título del sitio a la izquierda y el nombre de la
 * página Inicio en el menú. El copy SEO largo va solo a Rank Math / meta.
 */
export async function auditWordPressHeaderIdentity(
  config: WordPressConfig,
  identity: { siteName?: string; homeNavTitle?: string } = {},
): Promise<WordPressHeaderIdentity> {
  const siteName = identity.siteName ?? WP_HEADER_SITE_NAME;
  const homeNavTitle = identity.homeNavTitle ?? WP_HEADER_HOME_NAV_TITLE;
  try {
    const { settings, page } = await readFrontPage(config);
    const siteTitle = (settings.title ?? '').trim();
    const homePageTitle = page ? rawPageTitle(page) : homeNavTitle;
    const siteOk = !looksLikeSeoHeadline(siteTitle, siteName) && siteTitle.length > 0;
    const pageOk = !page || !looksLikeSeoHeadline(homePageTitle, siteName);
    const ok = siteOk && pageOk;
    return {
      siteTitle,
      homePageTitle,
      homePageId: page?.id ?? null,
      ok,
      detail: ok
        ? `Header OK: sitio “${siteTitle}” / menú “${homePageTitle}” (SEO largo solo en meta)`
        : `El header muestra copy SEO. Dejá título del sitio = “${siteName}” y la página de inicio = “${homeNavTitle}”; la frase larga va a Rank Math.`,
    };
  } catch (err) {
    return {
      siteTitle: '',
      homePageTitle: '',
      homePageId: null,
      ok: false,
      detail: err instanceof Error ? err.message : 'No se pudo leer título del sitio / Inicio',
    };
  }
}

/** Restaura blogname + título de Inicio si alguien los pisó con copy SEO. */
export async function protectWordPressHeaderIdentity(
  config: WordPressConfig,
  identity: { siteName?: string; homeNavTitle?: string } = {},
): Promise<WordPressHeaderIdentity> {
  const siteName = identity.siteName ?? WP_HEADER_SITE_NAME;
  const homeNavTitle = identity.homeNavTitle ?? WP_HEADER_HOME_NAV_TITLE;
  const { settings, page } = await readFrontPage(config);
  const siteTitle = (settings.title ?? '').trim();

  if (!siteTitle || looksLikeSeoHeadline(siteTitle, siteName)) {
    await wpFetch(config, '/settings', {
      method: 'POST',
      body: JSON.stringify({ title: siteName }),
    });
  }

  if (page && looksLikeSeoHeadline(rawPageTitle(page), siteName)) {
    await wpFetch(config, `/pages/${page.id}`, {
      method: 'POST',
      body: JSON.stringify({ title: homeNavTitle }),
    });
  }

  return auditWordPressHeaderIdentity(config, identity);
}

async function syncWordPressPageSeoMeta(
  config: WordPressConfig,
  pageId: number,
  seo: WordPressSeoInput,
): Promise<boolean> {
  const metaFields = buildSeoMetaPayload(seo);
  if (Object.keys(metaFields).length === 0) return false;
  await wpFetch(config, `/pages/${pageId}`, {
    method: 'POST',
    body: JSON.stringify({ meta: metaFields }),
  });
  return true;
}

/**
 * Aplica copy SEO de la home sin tocar el header.
 * Escribe Rank Math (rank_math_title / description) en la página de inicio
 * y deja blogname = Cleexs / post_title = Inicio.
 */
export async function applyHomeSeoMeta(
  config: WordPressConfig,
  seo: WordPressSeoInput,
  identity: { siteName?: string; homeNavTitle?: string } = {},
): Promise<WordPressHeaderIdentity & { seoApplied: boolean }> {
  const header = await protectWordPressHeaderIdentity(config, identity);
  let seoApplied = false;
  if (header.homePageId && hasSeoPluginConfigured()) {
    try {
      seoApplied = await syncWordPressPageSeoMeta(config, header.homePageId, seo);
    } catch (err) {
      console.warn('[wordpress] No se pudo escribir meta SEO de la home:', err);
    }
  }
  return { ...header, seoApplied };
}

function isWordPressFrontPage(page: WpPage, frontPageId: number | null, siteUrl: string): boolean {
  if (frontPageId && page.id === frontPageId) return true;
  const link = page.link.replace(/\/$/, '');
  const home = siteUrl.replace(/\/$/, '');
  return link === home;
}

/** Busca o crea/actualiza una página WP (p. ej. slug llms-txt). */
export async function upsertWordPressPage(
  config: WordPressConfig,
  input: {
    slug: string;
    title: string;
    content: string;
    status?: 'draft' | 'publish' | 'private';
  },
): Promise<WpPage> {
  const search = encodeURIComponent(input.slug);
  const existing = await wpFetch<WpPage[]>(
    config,
    `/pages?slug=${search}&per_page=5&status=any&context=edit`,
  );
  const match = existing.find((p) => p.slug === input.slug);
  const body: Record<string, unknown> = {
    title: input.title,
    content: input.content,
    slug: input.slug,
    status: input.status ?? 'publish',
  };

  if (match) {
    try {
      const settings = await readWordPressSettings(config);
      const frontId = Number(settings.page_on_front) || null;
      if (isWordPressFrontPage(match, frontId, config.baseUrl) && looksLikeSeoHeadline(input.title)) {
        delete body.title;
      }
    } catch {
      // si no podemos leer settings, no arriesgamos el header de Inicio
      if (looksLikeSeoHeadline(input.title)) {
        delete body.title;
      }
    }
    return wpFetch<WpPage>(config, `/pages/${match.id}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  return wpFetch<WpPage>(config, '/pages', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
