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
  };

  if (payload.excerpt) body.excerpt = payload.excerpt;
  if (payload.slug) body.slug = payload.slug;
  if (payload.categories?.length) {
    body.categories = payload.categories;
  } else if (config.defaultCategoryId) {
    body.categories = [config.defaultCategoryId];
  }

  return wpFetch<WordPressPostResponse>(config, '/posts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** URL pública legible (cleexs.net/articulos/slug/), no el preview ?p= de borradores. */
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
  return wpFetch<WordPressPostResponse>(config, `/posts/${postId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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
